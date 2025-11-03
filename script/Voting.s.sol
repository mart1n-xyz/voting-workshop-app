// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {Voting} from "../src/Voting.sol";

/**
 * @title Deploy Voting Contract
 * @dev Script to deploy the Voting contract to Status Network Sepolia
 * 
 * Usage:
 * source .env
 * forge script script/Voting.s.sol:DeployVoting --rpc-url status_sepolia --broadcast -vvvv
 * 
 * Make sure your .env file has:
 * RPC_ENDPOINT=https://public.sepolia.rpc.status.network
 * PRIVATE_KEY=your_private_key_here
 */
contract DeployVoting is Script {
    function run() external returns (Voting) {
        // Get the deployer's private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the Voting contract
        Voting voting = new Voting();
        
        console.log("Voting contract deployed to:", address(voting));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        return voting;
    }
}

