import {
  Cl,          // Clarity value builder (e.g., Cl.uint, Cl.principal) for constructing arguments to contract calls
  cvToValue,   // Converts a ClarityValue (CV) to a JavaScript value for assertions (e.g., boolean true/false)
  signMessageHashRsv, // Signs a message hash using ECDSA (secp256k1) to produce an RSV signature for on-chain verification
} from "@stacks/transactions"; // Stacks SDK for transaction building, signing, and Clarity interactions
import { beforeEach, describe, expect, it } from "vitest"; // Vitest testing framework for setup, suites, and assertions

// `simnet` is a "simulation network" - a local, testing Stacks node for running our tests
// This provides methods like callPublicFn, mineEmptyBlock, getMapEntry, etc., to simulate blockchain state and executions
const accounts = simnet.getAccounts(); // Retrieves pre-configured wallet accounts for testing (e.g., wallet_1, wallet_2)

// The identifiers of these wallets can be found in the `settings/Devnet.toml` config file
// You can also change the identifiers of these wallets in those files if you want
const sender = accounts.get("wallet_1")!;     // Wallet acting as the stream creator/funder (principal for tx-sender in stream-to/refuel)
const recipient = accounts.get("wallet_2")!;  // Wallet receiving streamed tokens over time (withdraws from stream)
const randomUser = accounts.get("wallet_3")!; // Unauthorized third-party wallet for negative testing (e.g., unauthorized refuel/withdraw)

describe("test token streaming contract", () => { // Test suite for the entire 'stream' contract
  // Before each test is run, we want to create a stream
  // so we can run tests around different possible things to do with the stream
  // This hooks into each 'it' block to reset state: deploys contract (if needed) and creates a base stream with 5 STX, timeframe 0-5 blocks, 1 STX/block
  beforeEach(() => {
    // Calls the public 'stream-to' function to create stream ID 0
    // Args: recipient principal, initial 5 STX balance, timeframe tuple (start=0, stop=5), 1 STX per block
    // This mines a block, transfers 5 STX to contract, and sets up the stream map entry
    const result = simnet.callPublicFn(
      "stream", // Contract name
      "stream-to", // Public function to create a new stream
      [
        Cl.principal(recipient), // Recipient of the stream
        Cl.uint(5), // Initial locked balance (STX)
        Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(5) }), // Timeframe for streaming
        Cl.uint(1), // Payment rate (1 STX per block elapsed)
      ],
      sender // Caller (tx-sender): wallet_1 funds the stream
    );

    // Asserts the STX transfer event was emitted during stream creation
    expect(result.events[0].event).toBe("stx_transfer_event");
    expect(result.events[0].data.amount).toBe("5"); // 5 STX transferred to contract
    expect(result.events[0].data.sender).toBe(sender); // From sender wallet
  });

  // Tests that the contract initializes correctly and the stream is stored as expected
  it("ensures contract is initialized properly and stream is created", () => {
    // Fetches the latest stream ID data var (should be 1 after creation)
    const latestStreamId = simnet.getDataVar("stream", "latest-stream-id");
    expect(latestStreamId).toBeUint(1); // Asserts ID incremented to 1

    // Retrieves the stream map entry for ID 0
    const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    // Asserts the stream tuple matches expected structure (sender, recipient, balance=5, withdrawn=0, etc.)
    expect(createdStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(5),
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(1),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(5),
        }),
      })
    );
  });

  // Tests refueling: sender adds more STX to an existing stream (increases balance to 10)
  it("ensures stream can be refueled", () => {
    // Calls 'refuel' with stream ID 0 and additional 5 STX
    const result = simnet.callPublicFn(
      "stream",
      "refuel",
      [Cl.uint(0), Cl.uint(5)], // Stream ID and amount
      sender // Only sender can refuel
    );

    // Asserts STX transfer event for the refuel amount
    expect(result.events[0].event).toBe("stx_transfer_event");
    expect(result.events[0].data.amount).toBe("5");
    expect(result.events[0].data.sender).toBe(sender);

    // Verifies updated stream balance is now 10 STX
    const createdStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    expect(createdStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(10), // Increased from 5
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(1),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(5),
        }),
      })
    );
  });

  // Negative test: unauthorized user cannot refuel a stream
  it("ensures stream cannot be refueled by random address", () => {
    // Attempts refuel with randomUser (not sender)
    const result = simnet.callPublicFn(
      "stream",
      "refuel",
      [Cl.uint(0), Cl.uint(5)],
      randomUser
    );

    // Expects error code u0 (ERR_UNAUTHORIZED)
    expect(result.result).toBeErr(Cl.uint(0));
  });

  // Tests withdrawal: recipient claims vested tokens based on elapsed blocks (delta=4 at this point)
  it("ensures recipient can withdraw tokens over time", () => {
    // Block 1 was used to deploy contract
    // Block 2 was used to create stream
    // `withdraw` will be called in Block 3
    // so expected to withdraw (Block 3 - Start_Block) = (3 - 0) tokens
    // Note: Actual delta is 4 due to simnet block height semantics (height=4 during withdraw execution)
    const withdraw = simnet.callPublicFn(
      "stream",
      "withdraw",
      [Cl.uint(0)], // Stream ID
      recipient // Only recipient can withdraw
    );

    // Asserts STX transfer event to recipient
    expect(withdraw.events[0].event).toBe("stx_transfer_event");
    expect(withdraw.events[0].data.amount).toBe("4"); // 4 STX vested (1 per block * delta)
    expect(withdraw.events[0].data.recipient).toBe(recipient);
  });

  // Negative test: non-recipient cannot withdraw
  it("ensures non-recipient cannot withdraw tokens from stream", () => {
    // Attempts withdraw with randomUser
    const withdraw = simnet.callPublicFn(
      "stream",
      "withdraw",
      [Cl.uint(0)],
      randomUser
    );

    // Expects error code u0 (ERR_UNAUTHORIZED)
    expect(withdraw.result).toBeErr(Cl.uint(0));
  });

  // Tests refund: sender reclaims excess unvested tokens after stream end
  it("ensures sender can withdraw excess tokens", () => {
    // Block 3: Refuel with extra 5 STX (total balance=10)
    simnet.callPublicFn("stream", "refuel", [Cl.uint(0), Cl.uint(5)], sender);

    // Block 4 and 5: Mine empty blocks to advance height past stop-block=5
    simnet.mineEmptyBlock();
    simnet.mineEmptyBlock();

    // Recipient claims vested tokens (should claim ~5 STX based on full timeframe)
    simnet.callPublicFn("stream", "withdraw", [Cl.uint(0)], recipient);

    // Sender refunds excess (unvested portion, here 5 STX from refuel)
    const refund = simnet.callPublicFn(
      "stream",
      "refund",
      [Cl.uint(0)], // Stream ID
      sender // Only sender can refund after end
    );

    // Asserts refund transfer back to sender
    expect(refund.events[0].event).toBe("stx_transfer_event");
    expect(refund.events[0].data.amount).toBe("5"); // Excess 5 STX returned
    expect(refund.events[0].data.recipient).toBe(sender);
  });

  // Tests off-chain signing and on-chain signature verification for stream hash
  it("signature verification can be done on stream hashes", () => {
    // Calls read-only 'hash-stream' to compute SHA256 of concatenated stream data + new params
    const hashedStream0 = simnet.callReadOnlyFn(
      "stream",
      "hash-stream",
      [
        Cl.uint(0), // Existing stream ID
        Cl.uint(0), // Proposed new payment-per-block
        Cl.tuple({ "start-block": Cl.uint(1), "stop-block": Cl.uint(2) }), // Proposed new timeframe
      ],
      sender // Caller (irrelevant for read-only, but required)
    );

    // Extracts hex string from Clarity buffer value (hash as 32-byte hex)
    const hashAsHex = (hashedStream0.result as any).value as string;
    // Signs the hash off-chain using sender's private key (RSV format: 65 bytes)
    const signature = signMessageHashRsv({
      messageHash: hashAsHex, // 32-byte hash to sign
      privateKey:
        "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801", // wallet_1 private key from Devnet.toml
    });

    // Calls read-only 'validate-signature' to verify sig recovers to sender principal
    const verifySignature = simnet.callReadOnlyFn(
      "stream",
      "validate-signature",
      [
        Cl.bufferFromHex(hashAsHex), // Original hash as buffer
        Cl.bufferFromHex(signature), // RSV signature as hex buffer (note: signature is already hex string)
        Cl.principal(sender), // Expected recovered signer
      ],
      sender
    );

    // Asserts verification returns true
    expect(cvToValue(verifySignature.result)).toBe(true);
  });

  // Tests updating stream params (payment/timeframe) with dual-party consent via signed hash
  it("ensures timeframe and payment per block can be modified with consent of both parties", () => {
    // Computes hash of proposed update (same stream, new payment=1, timeframe=0-4)
    const hashedStream0 = simnet.callReadOnlyFn(
      "stream",
      "hash-stream",
      [
        Cl.uint(0),
        Cl.uint(1), // New payment-per-block
        Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), // New timeframe (shorter stop)
      ],
      sender
    );

    // Extracts hex hash
    const hashAsHex = (hashedStream0.result as any).value as string;
    // Sender signs the update proposal off-chain
    const senderSignature = signMessageHashRsv({
      messageHash: hashAsHex,
      // This private key is for the `sender` wallet - i.e. `wallet_1`
      // This can be found in the `settings/Devnet.toml` config file
      privateKey:
        "7287ba251d44a4d3fd9276c88ce34c5c52a038955511cccaf77e61068649c17801",
    });

    // Recipient calls 'update-details' with signed proposal (verifies sig from sender)
    simnet.callPublicFn(
      "stream",
      "update-details",
      [
        Cl.uint(0), // Stream ID
        Cl.uint(1), // New payment-per-block
        Cl.tuple({ "start-block": Cl.uint(0), "stop-block": Cl.uint(4) }), // New timeframe
        Cl.principal(sender), // Signer (sender providing consent via sig)
        Cl.bufferFromHex(senderSignature), // Signed hash as buffer
      ],
      recipient // Caller: recipient (other party consents by submitting)
    );

    // Verifies stream updated with new timeframe (stop-block=4), payment unchanged
    const updatedStream = simnet.getMapEntry("stream", "streams", Cl.uint(0));
    expect(updatedStream).toBeSome(
      Cl.tuple({
        sender: Cl.principal(sender),
        recipient: Cl.principal(recipient),
        balance: Cl.uint(5),
        "withdrawn-balance": Cl.uint(0),
        "payment-per-block": Cl.uint(1),
        timeframe: Cl.tuple({
          "start-block": Cl.uint(0),
          "stop-block": Cl.uint(4), // Updated
        }),
      })
    );
  });
});