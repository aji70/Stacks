;; title: stream
;; version:
;; summary:
;; description:

;; errors
(define-constant ERR_UNAUTHORIZED (err u0)) ;; Error for unauthorized access (e.g., wrong caller for refuel/withdraw/refund)
(define-constant ERR_INVALID_SIGNATURE (err u1)) ;; Error for invalid signature in update-details
(define-constant ERR_STREAM_STILL_ACTIVE (err u2)) ;; Error when trying to refund before stream ends (stop-block not passed)
(define-constant ERR_INVALID_STREAM_ID (err u3)) ;; Error when stream ID doesn't exist in map
;; new error for validating timeframe and amount
(define-constant ERR_INVALID_AMOUNT (err u4)) ;; Error when amount (initial-balance or refuel) is 0 or invalid
(define-constant ERR_INVALID_TIMEFRAME (err u5)) ;; Error when timeframe stop-block <= start-block

;; data vars
(define-data-var latest-stream-id uint u0) ;; Tracks the next available stream ID (starts at 0, increments on creation)

;; mapping 
(define-map streams
    uint ;; stream-id (key: sequential uint from 0)
    {
        sender: principal, ;; Original creator/funder of the stream
        recipient: principal, ;; Beneficiary who withdraws over time
        balance: uint, ;; Total locked STX in the stream (initial + refuels)
        withdrawn-balance: uint, ;; Cumulative STX already withdrawn by recipient
        payment-per-block: uint, ;; Rate: STX vested per block elapsed (can be updated with consent)
        timeframe: { ;; Streaming window
            start-block: uint, ;; Block height when vesting begins
            stop-block: uint, ;; Block height when vesting ends (must > start-block)
        },
    }
) ;; Stores all active streams as a map (ID -> stream tuple)

;; public functions
;; create stream function
(define-public (stream-to
        (recipient principal) ;; Who receives the streamed STX
        (initial-balance uint) ;; Amount of STX to lock initially
        (timeframe { ;; Vesting period
            start-block: uint,
            stop-block: uint,
        })
        (payment-per-block uint) ;; Vesting rate (STX per block)
    )
    ;; Local vars for new stream tuple and current ID
    (let (
            (stream {
                sender: contract-caller, ;; tx-sender (funder)
                recipient: recipient,
                balance: initial-balance,
                withdrawn-balance: u0, ;; Starts at 0
                payment-per-block: payment-per-block,
                timeframe: timeframe,
            })
            (current-stream-id (var-get latest-stream-id)) ;; Get next ID
        )
        ;; checks whether the stop-block is greater than start-block
        (asserts!
            (> (get stop-block (get timeframe stream)) ;; Extract stop from stream's timeframe
                (get start-block (get timeframe stream)) ;; Extract start
            )
            ERR_INVALID_TIMEFRAME ;; Fail if invalid (stop <= start)
        )
        ;; checks for ensuring initial-balance is greater than 0
        (asserts! (> initial-balance u0) ERR_INVALID_AMOUNT) ;; Fail if balance <= 0
        ;; stx-transfer takes in (amount, sender, recipient) arguments
        ;; for the `recipient` - we do `(as-contract tx-sender)`
        ;; so doing `as-contract tx-sender` gives us the contract address itself
        ;; this is like doing address(this) in Solidity
        ;; Transfers initial STX from caller to contract (locked)
        (try! (stx-transfer? initial-balance contract-caller (as-contract tx-sender)))
        ;; Store the new stream in map under current ID
        (map-set streams current-stream-id stream)
        ;; Increment global ID counter
        (var-set latest-stream-id (+ current-stream-id u1))
        ;; Returns the created stream ID
        (ok current-stream-id)
    )
)

;; function to refuel a stream 
;; Increase the locked STX balance for a stream
(define-public (refuel
        (stream-id uint) ;; ID of existing stream
        (amount uint) ;; Additional STX to lock
    )
    ;; Fetch existing stream or fail
    (let ((stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)))
        ;; Only sender can refuel
        (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
        ;; amount should be greater than 0
        (asserts! (> amount u0) ERR_INVALID_AMOUNT) ;; Fail if <=0
        ;; Transfer additional STX to contract
        (try! (stx-transfer? amount contract-caller (as-contract tx-sender)))
        ;; Update balance in map (add to existing)
        (map-set streams stream-id
            (merge stream { balance: (+ (get balance stream) amount) })
        )
        ;; Returns added amount
        (ok amount)
    )
)

;; calculate the number of blocks a stream has been active
;; Computes vested blocks: min(current height - start, full duration) if active, else 0
(define-read-only (calculate-block-delta (timeframe { ;; Input: timeframe tuple
    start-block: uint,
    stop-block: uint,
}))
    (let (
            (start-block (get start-block timeframe)) ;; Extract start
            (stop-block (get stop-block timeframe)) ;; Extract stop
            ;; Logic: 0 if before start; elapsed if active; full if past stop
            (delta (if (<= stacks-block-height start-block)
                ;; then (before start)
                u0
                ;; else (after start)
                (if (< stacks-block-height stop-block)
                    ;; then (still active)
                    (- stacks-block-height start-block) ;; Elapsed blocks
                    ;; else (past stop)
                    (- stop-block start-block) ;; Full duration
                )
            ))
        )
        ;; Returns delta (uint blocks)
        delta
    )
)

;; Check balance for a party involved in a stream
;; Computes available balance: vested for recipient (less withdrawn), or excess for sender
(define-read-only (balance-of
        (stream-id uint) ;; Stream to query
        (who principal) ;; Sender or recipient
    )
    (let (
            (stream (unwrap! (map-get? streams stream-id) u0)) ;; Fetch stream or 0
            (block-delta (calculate-block-delta (get timeframe stream))) ;; Vested blocks
            (recipient-balance (* block-delta (get payment-per-block stream))) ;; Total vested STX
        )
        ;; Recipient: vested minus already withdrawn
        (if (is-eq who (get recipient stream))
            (- recipient-balance (get withdrawn-balance stream))
            ;; Sender: total balance minus vested
            (if (is-eq who (get sender stream))
                (- (get balance stream) recipient-balance)
                ;; Other: 0
                u0
            )
        )
    )
)

;; Withdraw received tokens
;; Recipient claims vested (unwithdrawn) STX; updates withdrawn balance
(define-public (withdraw (stream-id uint)) ;; Stream ID
    (let (
            (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ;; Fetch or fail
            (balance (balance-of stream-id contract-caller)) ;; Compute available for caller
        )
        ;; Only recipient can withdraw
        (asserts! (is-eq contract-caller (get recipient stream)) ERR_UNAUTHORIZED)
        ;; Update withdrawn balance (add claimed)
        (map-set streams stream-id
            (merge stream { withdrawn-balance: (+ (get withdrawn-balance stream) balance) })
        )
        ;; Transfer vested STX from contract to recipient (tx-sender)
        (try! (as-contract (stx-transfer? balance tx-sender (get recipient stream))))
        ;; Returns claimed amount
        (ok balance)
    )
)

;; Withdraw excess locked tokens
;; Sender reclaims unvested STX after stream fully ends
(define-public (refund (stream-id uint)) ;; Stream ID
    (let (
            (stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)) ;; Fetch or fail
            (balance (balance-of stream-id (get sender stream))) ;; Excess for sender
        )
        ;; Only sender can refund
        (asserts! (is-eq contract-caller (get sender stream)) ERR_UNAUTHORIZED)
        ;; Must be past stop-block
        (asserts! (< (get stop-block (get timeframe stream)) stacks-block-height)
            ERR_STREAM_STILL_ACTIVE ;; Fail if still active
        )

        ;; Update total balance (subtract excess)
        (map-set streams stream-id
            (merge stream { balance: (- (get balance stream) balance) })
        )
        ;; Transfer excess back to sender
        (try! (as-contract (stx-transfer? balance tx-sender (get sender stream))))
        ;; Returns refunded amount
        (ok balance)
    )
)

;; Get hash of stream
;; Computes deterministic SHA256 for signing updates: concat(existing stream + new params)
(define-read-only (hash-stream
        (stream-id uint) ;; Existing stream
        (new-payment-per-block uint) ;; Proposed payment rate
        (new-timeframe { ;; Proposed timeframe
            start-block: uint,
            stop-block: uint,
        })
    )
    (let (
            (stream (unwrap! (map-get? streams stream-id) (sha256 0))) ;; Fetch or default hash(0)
            ;; Concat buffers: stream tuple + new payment + new timeframe (for signing)
            (msg (concat
                (concat (unwrap-panic (to-consensus-buff? stream)) ;; Serialize stream to bytes
                    (unwrap-panic (to-consensus-buff? new-payment-per-block)) ;; Serialize uint
                )
                (unwrap-panic (to-consensus-buff? new-timeframe)) ;; Serialize tuple
            ))
        )
        ;; Returns 32-byte SHA256 hash
        (sha256 msg)
    )
)

;; Signature verification
;; Recovers signer from ECDSA sig and checks it matches expected principal
(define-read-only (validate-signature
        (hash (buff 32)) ;; Signed message hash
        (signature (buff 65)) ;; RSV signature (r,s,v concatenated)
        (signer principal) ;; Expected recovered signer
    )
    ;; Recover public key, get principal, compare to expected
    (is-eq (principal-of? (unwrap! (secp256k1-recover? hash signature) false))
        (ok signer) ;; True if matches
    )
)

;; Update stream configuration
;; Applies new payment/timeframe if signed by the non-caller party (dual consent)
(define-public (update-details
        (stream-id uint) ;; Stream to update
        (payment-per-block uint) ;; New rate
        (timeframe { ;; New vesting window
            start-block: uint,
            stop-block: uint,
        })
        (signer principal) ;; Party providing off-chain consent (via sig)
        (signature (buff 65)) ;; Signed hash of proposed update
    )
    ;; Fetch existing stream or fail
    (let ((stream (unwrap! (map-get? streams stream-id) ERR_INVALID_STREAM_ID)))
        ;; Verify sig recovers to signer (one party consents off-chain)
        (asserts!
            (validate-signature
                (hash-stream stream-id payment-per-block timeframe) ;; Re-compute hash on-chain
                signature signer
            )
            ERR_INVALID_SIGNATURE ;; Fail if invalid
        )
        ;; Caller must be the other party (dual consent: caller submits, signer approves)
        (asserts!
            (or
                ;; Case 1: Caller=sender, signer=recipient
                (and (is-eq (get sender stream) contract-caller) (is-eq (get recipient stream) signer))
                ;; Case 2: Caller=recipient, signer=sender
                (and (is-eq (get sender stream) signer) (is-eq (get recipient stream) contract-caller))
            )
            ERR_UNAUTHORIZED ;; Fail if not dual-party
        )
        ;; Update map with new params (balance/withdrawn unchanged)
        (map-set streams stream-id
            (merge stream {
                payment-per-block: payment-per-block,
                timeframe: timeframe,
            })
        )
        ;; Returns success
        (ok true)
    )
)