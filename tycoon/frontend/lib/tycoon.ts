import { STACKS_TESTNET, STACKS_MAINNET,StacksNetwork  } from "@stacks/network";
import {
  ClarityType,
  ClarityValue,
  SomeCV,
  StringAsciiCV,
  TupleCV,
  UIntCV,
  fetchCallReadOnlyFunction,
  principalCV,
  stringAsciiCV,
} from "@stacks/transactions";

// REPLACE THESE WITH YOUR OWN
const TYCOON_CONTRACT_ADDRESS = "ST81CZF1YK81CPAMS6PRS3GJSKK35MGZ2VWEPSEN";
const TYCOON_CONTRACT_NAME = "tycoon";
const TYCOON_CONTRACT_PRINCIPAL = `${TYCOON_CONTRACT_ADDRESS}.${TYCOON_CONTRACT_NAME}`;

export type User = {
  username: string;
  registeredAt: number;
};
// Helper to get network object
function getNetwork(networkName: 'mainnet' | 'testnet' = 'testnet'): StacksNetwork {
  return networkName === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}
// is-registered
// Returns a boolean indicating if the user is registered
export async function isRegistered(networkName: 'mainnet' | 'testnet' = 'testnet', user: string): Promise<boolean> {
  const network = getNetwork(networkName);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: TYCOON_CONTRACT_ADDRESS,
    contractName: TYCOON_CONTRACT_NAME,
    functionName: "is-registered",
    functionArgs: [principalCV(user)],
    senderAddress: TYCOON_CONTRACT_ADDRESS,
    network,
  });

  return result.type === ClarityType.BoolTrue;
}

// get-user
// Returns the User object if registered, otherwise null
export async function getUser(networkName: 'mainnet' | 'testnet' = 'testnet', user: string): Promise<User | null> {
  const network = getNetwork(networkName);
  const result = await fetchCallReadOnlyFunction({
    contractAddress: TYCOON_CONTRACT_ADDRESS,
    contractName: TYCOON_CONTRACT_NAME,
    functionName: "get-user",
    functionArgs: [principalCV(user)],
    senderAddress: TYCOON_CONTRACT_ADDRESS,
    network,
  });

  if (result.type !== ClarityType.OptionalSome) {
    return null;
  }

  const someCV = result as SomeCV;
  const tupleCV = someCV.value;
  if (tupleCV.type !== ClarityType.Tuple) {
    return null;
  }

  const tuple = (tupleCV as TupleCV).value;
  const usernameCV = tuple.username;
  const registeredAtCV = tuple["registered-at"];

  if (usernameCV.type !== ClarityType.StringASCII) {
    return null;
  }
  if (registeredAtCV.type !== ClarityType.UInt) {
    return null;
  }

  const username = (usernameCV as StringAsciiCV).value;
  const registeredAt = Number((registeredAtCV as UIntCV).value);

  return {
    username,
    registeredAt,
  };
}


// register
// Returns transaction options for registering a user with the given username
export async function register(networkName: 'mainnet' | 'testnet' = 'testnet', username: string) {
  // Client-side validation (mirrors contract checks)
  const usernameBytes = new TextEncoder().encode(username).length;
  if (usernameBytes === 0 || usernameBytes > 32) {
    throw new Error("Username must be 1-32 characters long");
  }

  const txOptions = {
    contractAddress: TYCOON_CONTRACT_ADDRESS,
    contractName: TYCOON_CONTRACT_NAME,
    functionName: "register",
    functionArgs: [stringAsciiCV(username)],
    network: networkName,
  };

  return txOptions;
}