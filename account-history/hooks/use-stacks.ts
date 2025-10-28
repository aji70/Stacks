import {
  connect,
  disconnect,
  getLocalStorage,
  isConnected,
} from "@stacks/connect";
import { useEffect, useState } from "react";

type UserData = {
  addresses: {
    stx: { address: string }[];
    btc: { address: string }[];
  };
};

// Define a type for the network state
type Network = "mainnet" | "testnet" | null;

/**
 * A hook that provides wallet connection and disconnection functionality using the @stacks/connect library.
 * It returns the user's data and two functions to connect and disconnect the wallet.
 * Upon successful connection, it updates the user's data in the component's state.
 * If the connection fails, it logs an error to the console.
 */
export function useStacks() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [network, setNetwork] = useState<Network>(null);

  /**
   * Handles updating the user's data and network state based on the provided data.
   * If the data is not null, it extracts the user's Stacks address and determines the network
   * (mainnet or testnet) based on the address prefix. It then updates the user's data and network state.
   * If the data is null, it resets both the user's data and network state to null.
   */
  function handleUserData(data: UserData | null) {
    if (data) {
      const stxAddress = data.addresses?.stx?.[0]?.address;
      if (stxAddress) {
        // Check the address prefix to determine the network
        setNetwork(stxAddress.startsWith("ST") ? "testnet" : "mainnet");
        setUserData(data);
      }
    } else {
      // If data is null, reset both user data and network
      setUserData(null);
      setNetwork(null);
    }
  }

  /**
   * Connects the user's wallet to the app using the @stacks/connect library.
   * It first calls the connect function and then updates the user's data and network state
   * based on the provided data. If the connection fails, it logs an error to the console.
   */
  async function connectWallet() {
    try {
      await connect();
      handleUserData(getLocalStorage());
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  }

  /**
   * Disconnects the user's wallet from the app.
   * It calls the disconnect function from the @stacks/connect library and then updates the user's data and network state to null.
   */
  function disconnectWallet() {
    disconnect();
    handleUserData(null);
  }

  // Check if a session exists in local storage
  useEffect(() => {
    if (isConnected()) {
      // If a session exists in local storage, load it into the state
      handleUserData(getLocalStorage());
    }
  }, []);

  // Return user data and wallet functions
  return { userData, network, connectWallet, disconnectWallet };
}