;; contracts/tycoon.clar
;; Minimal Tycoon Contract in Clarity
;; Allows users to register with a unique username and checks if registered

;; Errors
(define-constant ERR_ALREADY_REGISTERED (err u100))
(define-constant ERR_USERNAME_TAKEN (err u101))
(define-constant ERR_INVALID_USERNAME (err u102))

;; Data Structures
(define-map users principal {username: (string-ascii 32), registered-at: uint})
(define-map usernames (string-ascii 32) principal)

;; Read-only function to check if a user is registered
(define-read-only (is-registered (user principal))
  (is-some (map-get? users user))
)

;; Public function to register a user with a username
;; Username must be unique and non-empty (1-32 chars)
(define-public (register (username (string-ascii 32)))
  (let
    (
      (caller tx-sender)
      (username-bytes (len username))
      (existing-user (map-get? users caller))
      (existing-username (map-get? usernames username))
    )
    ;; Check if already registered
    (asserts! (not (is-some existing-user)) ERR_ALREADY_REGISTERED)
    ;; Check if username is valid length
    (asserts! (and (> username-bytes u0) (<= username-bytes u32)) ERR_INVALID_USERNAME)
    ;; Check if username is taken
    (asserts! (not (is-some existing-username)) ERR_USERNAME_TAKEN)
    ;; Register the user
    (map-set users caller {username: username, registered-at: stacks-block-height})
    (map-set usernames username caller)
    (ok true)
  )
)

;; Read-only function to get user info
(define-read-only (get-user (user principal))
  (map-get? users user)
)