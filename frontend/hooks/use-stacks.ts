import { register, isRegistered, getUser, User } from "@/lib/tycoon";
import { getStxBalance } from "@/lib/stx-utils";
import {
  connect,
  disconnect,
  getLocalStorage,
  isConnected,
  openContractCall,
} from "@stacks/connect";
import { PostConditionMode } from "@stacks/transactions";
import { useEffect, useState } from "react";

type UserData = {
  addresses: {
    stx: { address: string }[];
    btc: { address: string }[];
  };
};

type Network = "mainnet" | "testnet" | null;

export function useStacks() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [stxBalance, setStxBalance] = useState(0);
  const [network, setNetwork] = useState<Network>(null);
  const [tycoonUser, setTycoonUser] = useState<User | null>(null);

  function handleUserData(data: UserData | null) {
    if (data) {
      const stxAddress = data.addresses?.stx?.[0]?.address;
      if (stxAddress) {
        setNetwork(stxAddress.startsWith("ST") ? "testnet" : "mainnet");
        setUserData(data);
      }
    } else {
      setUserData(null);
      setNetwork(null);
      setTycoonUser(null);
    }
  }

  function connectWallet() {
    connect().then(() => {
      handleUserData(getLocalStorage());
    }).catch((error) => {
      console.error("Wallet connection failed:", error);
    });
  }

  function disconnectWallet() {
    disconnect();
    handleUserData(null);
    setStxBalance(0);
  }

  async function handleRegister(username: string) {
    if (typeof window === "undefined") return;
    try {
      if (!userData || !network) throw new Error("User not connected");
      const txOptions = await register(network, username);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent register transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function checkIfRegistered(): Promise<boolean> {
    if (!userData || !network) return false;
    const address = userData.addresses.stx[0].address;
    return await isRegistered(network, address);
  }

  async function fetchUserInfo(): Promise<User | null> {
    if (!userData || !network) return null;
    const address = userData.addresses.stx[0].address;
    return await getUser(network, address);
  }

  useEffect(() => {
    if (isConnected()) {
      handleUserData(getLocalStorage());
    }
  }, []);

  useEffect(() => {
    if (userData) {
      const address = userData.addresses.stx[0].address;
      getStxBalance(address).then((balance) => {
        setStxBalance(balance);
      });

      // Fetch Tycoon user info
      fetchUserInfo().then(setTycoonUser);
    } else {
      setStxBalance(0);
      setTycoonUser(null);
    }
  }, [userData]);

  return {
    userData,
    stxBalance,
    network,
    tycoonUser,
    connectWallet,
    disconnectWallet,
    handleRegister,
    checkIfRegistered,
    fetchUserInfo,
  };
}