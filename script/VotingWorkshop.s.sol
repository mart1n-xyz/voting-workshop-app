// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console} from "forge-std/Script.sol";
import {VotingWorkshop} from "../src/VotingWorkshop.sol";

/**
 * @title Deploy VotingWorkshop Contract
 * @dev Script to deploy the VotingWorkshop contract to Status Network Sepolia
 * 
 * Usage:
 * source .env
 * forge script script/VotingWorkshop.s.sol:DeployVotingWorkshop --rpc-url status_sepolia --broadcast -vvvv
 * 
 * Make sure your .env file has:
 * RPC_ENDPOINT=https://public.sepolia.rpc.status.network
 * PRIVATE_KEY=your_private_key_here
 */
contract DeployVotingWorkshop is Script {
    function run() external returns (VotingWorkshop) {
        // Get the deployer's private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the VotingWorkshop contract
        VotingWorkshop workshop = new VotingWorkshop();
        
        console.log("VotingWorkshop contract deployed to:", address(workshop));
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        return workshop;
    }
}

