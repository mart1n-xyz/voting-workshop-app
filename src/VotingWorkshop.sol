// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title VotingWorkshop
 * @dev A workshop contract where users can register and get assigned sequential IDs
 */
contract VotingWorkshop {
    // Counter for the next user ID (starts at 1)
    uint256 private nextUserId = 1;
    
    // Mapping from user ID to address
    mapping(uint256 => address) public idToAddress;
    
    // Mapping from address to user ID
    mapping(address => uint256) public addressToId;
    
    // Events
    event UserRegistered(address indexed user, uint256 indexed userId);
    event UserExited(address indexed user, uint256 indexed userId);
    
    /**
     * @dev Register a user in the workshop
     * Assigns a sequential ID starting from 1
     * Users can only register once
     */
    function register() external {
        require(addressToId[msg.sender] == 0, "Already registered");
        
        // Assign the next available ID
        uint256 userId = nextUserId;
        
        // Store bidirectional mappings
        addressToId[msg.sender] = userId;
        idToAddress[userId] = msg.sender;
        
        // Increment for next user
        nextUserId++;
        
        emit UserRegistered(msg.sender, userId);
    }
    
    /**
     * @dev Exit the registry and cancel registration
     * Allows the user to register again later
     */
    function exitRegistry() external {
        uint256 userId = addressToId[msg.sender];
        require(userId != 0, "Not registered");
        
        // Clear both mappings
        delete idToAddress[userId];
        delete addressToId[msg.sender];
        
        emit UserExited(msg.sender, userId);
    }
    
    /**
     * @dev Get the total number of registered users
     */
    function getTotalRegistered() external view returns (uint256) {
        return nextUserId - 1;
    }
    
    /**
     * @dev Check if an address is registered
     */
    function isRegistered(address user) external view returns (bool) {
        return addressToId[user] != 0;
    }
}

