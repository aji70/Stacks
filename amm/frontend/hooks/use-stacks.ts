import {
  addLiquidity,
  createPool,
  Pool,
  removeLiquidity,
  swap,
} from "@/lib/amm";
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
    }
  }

  // Connect wallet
  function connectWallet() {
    connect()
      .then(() => {
        handleUserData(getLocalStorage());
      })
      .catch((error) => {
        console.error("Wallet connection failed:", error);
      });
  }

  // Disconnect wallet
  function disconnectWallet() {
    disconnect();
    handleUserData(null);
    setStxBalance(0);
  }

  // ---- Contract Interactions ----
  async function handleCreatePool(token0: string, token1: string, fee: number) {
    try {
      if (!userData) throw new Error("User not connected");
      const txOptions = await createPool(token0, token1, fee);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent create pool transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function handleSwap(pool: Pool, amount: number, zeroForOne: boolean) {
    try {
      if (!userData) throw new Error("User not connected");
      const txOptions = await swap(pool, amount, zeroForOne);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent swap transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function handleAddLiquidity(
    pool: Pool,
    amount0: number,
    amount1: number
  ) {
    try {
      if (!userData) throw new Error("User not connected");
      const txOptions = await addLiquidity(pool, amount0, amount1);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent add liquidity transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function handleRemoveLiquidity(pool: Pool, liquidity: number) {
    try {
      if (!userData) throw new Error("User not connected");
      const txOptions = await removeLiquidity(pool, liquidity);
      await openContractCall({
        ...txOptions,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent remove liquidity transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  // ---- Lifecycle ----
  useEffect(() => {
    if (isConnected()) {
      handleUserData(getLocalStorage());
    }
  }, []);

  useEffect(() => {
    if (userData) {
      const address = userData.addresses.stx[0].address;
      getStxBalance(address).then((balance) => setStxBalance(balance));
    } else {
      setStxBalance(0);
    }
  }, [userData]);

  return {
    userData,
    stxBalance,
    network,
    connectWallet,
    disconnectWallet,
    handleCreatePool,
    handleSwap,
    handleAddLiquidity,
    handleRemoveLiquidity,
  };
}
