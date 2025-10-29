import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";


const accounts = simnet.getAccounts();
const alice = accounts.get("wallet_1")!;

describe("Tycoon Tests", () => {
  it("allows a user to register with a unique username", () => {
    const { result: registerResult } = simnet.callPublicFn(
      "tycoon",
      "register",
      [Cl.stringAscii("AliceUser")],
      alice
    );

    expect(registerResult).toBeOk(Cl.bool(true));

    const { result: isRegisteredResult } = simnet.callReadOnlyFn(
      "tycoon",
      "is-registered",
      [Cl.principal(alice)],  // Checks if Alice's principal is registered
      alice
    );

    // For read-only functions, expect the direct value (bool), not Response
    expect(isRegisteredResult).toEqual(Cl.bool(true));
  });
});