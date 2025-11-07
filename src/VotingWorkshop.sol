// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VotingWorkshop
 * @dev A workshop contract where users can register and get assigned sequential IDs
 */
contract VotingWorkshop is Ownable {
    // Election status enum
    enum ElectionStatus {
        Closed,
        Open
    }
    
    // Election structure
    struct Election {
        uint256 id;
        ElectionStatus status;
        bool isPublic;
        uint256 openedAt;
        uint256 closedAt;
    }
    
    // Counter for the next election ID (starts at 1)
    uint256 private nextElectionId = 1;
    
    // Mapping from election ID to Election
    mapping(uint256 => Election) public elections;
    
    // Array to track all election IDs (for enumeration)
    uint256[] public electionIds;
    
    // Counter for the next user ID (starts at 1)
    uint256 private nextUserId = 1;
    
    // Mapping from user ID to address
    mapping(uint256 => address) public idToAddress;
    
    // Mapping from address to user ID
    mapping(address => uint256) public addressToId;
    
    // Voting data structures
    // Mapping from election ID => user ID => encrypted signature
    mapping(uint256 => mapping(uint256 => bytes)) private privateVotes;
    
    // Mapping from election ID => user ID => has voted
    mapping(uint256 => mapping(uint256 => bool)) public hasVoted;
    
    // Mapping from election ID => array of user IDs who voted (for enumeration)
    mapping(uint256 => uint256[]) private votersInElection;
    
    // Events
    event UserRegistered(address indexed user, uint256 indexed userId);
    event UserExited(address indexed user, uint256 indexed userId);
    event ElectionOpened(uint256 indexed electionId, bool isPublic, uint256 timestamp);
    event ElectionClosed(uint256 indexed electionId, uint256 timestamp);
    event PrivateVoteCast(uint256 indexed electionId, uint256 indexed userId, uint256 timestamp);
    
    constructor() Ownable(msg.sender) {}
    
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
    
    /**
     * @dev Open a new election or reopen an existing election
     * @param electionId The ID of the election to reopen (0 to create new election)
     * @param isPublic Whether the election is public (only used for new elections)
     * @return The ID of the opened election
     */
    function openElection(uint256 electionId, bool isPublic) external onlyOwner returns (uint256) {
        if (electionId == 0) {
            // Create a new election
            electionId = nextElectionId;
            elections[electionId] = Election({
                id: electionId,
                status: ElectionStatus.Open,
                isPublic: isPublic,
                openedAt: block.timestamp,
                closedAt: 0
            });
            electionIds.push(electionId);
            nextElectionId++;
        } else {
            // Reopen existing election - isPublic parameter is ignored
            require(elections[electionId].id != 0, "Election does not exist");
            require(elections[electionId].status == ElectionStatus.Closed, "Election is already open");
            
            elections[electionId].status = ElectionStatus.Open;
            elections[electionId].openedAt = block.timestamp;
            elections[electionId].closedAt = 0;
            // isPublic remains unchanged from original value
        }
        
        emit ElectionOpened(electionId, elections[electionId].isPublic, block.timestamp);
        return electionId;
    }
    
    /**
     * @dev Close an open election
     * @param electionId The ID of the election to close
     */
    function closeElection(uint256 electionId) external onlyOwner {
        require(elections[electionId].id != 0, "Election does not exist");
        require(elections[electionId].status == ElectionStatus.Open, "Election is not open");
        
        elections[electionId].status = ElectionStatus.Closed;
        elections[electionId].closedAt = block.timestamp;
        
        emit ElectionClosed(electionId, block.timestamp);
    }
    
    /**
     * @dev Get the total number of elections created
     */
    function getTotalElections() external view returns (uint256) {
        return electionIds.length;
    }
    
    /**
     * @dev Get election details
     */
    function getElection(uint256 electionId) external view returns (Election memory) {
        require(elections[electionId].id != 0, "Election does not exist");
        return elections[electionId];
    }
    
    /**
     * @dev Check if an election is currently open
     */
    function isElectionOpen(uint256 electionId) external view returns (bool) {
        return elections[electionId].id != 0 && elections[electionId].status == ElectionStatus.Open;
    }
    
    /**
     * @dev Cast a private vote in an election
     * @param electionId The ID of the election to vote in
     * @param encryptedSignature The encrypted signature representing the vote
     */
    function castPrivateVote(uint256 electionId, bytes calldata encryptedSignature) external {
        // Check election exists
        require(elections[electionId].id != 0, "Election does not exist");
        
        // Check election is open
        require(elections[electionId].status == ElectionStatus.Open, "Election is not open");
        
        // Check election is private
        require(!elections[electionId].isPublic, "Election is not private");
        
        // Check voter is registered
        uint256 userId = addressToId[msg.sender];
        require(userId != 0, "Voter is not registered");
        
        // Check voter hasn't voted yet
        require(!hasVoted[electionId][userId], "Already voted in this election");
        
        // Check encrypted signature is not empty
        require(encryptedSignature.length > 0, "Encrypted signature cannot be empty");
        
        // Store the vote
        privateVotes[electionId][userId] = encryptedSignature;
        hasVoted[electionId][userId] = true;
        votersInElection[electionId].push(userId);
        
        emit PrivateVoteCast(electionId, userId, block.timestamp);
    }
    
    /**
     * @dev Get a specific user's private vote in an election
     * @param electionId The ID of the election
     * @param userId The ID of the user
     * @return The encrypted signature
     */
    function getPrivateVote(uint256 electionId, uint256 userId) external view returns (bytes memory) {
        require(elections[electionId].id != 0, "Election does not exist");
        require(hasVoted[electionId][userId], "User has not voted in this election");
        return privateVotes[electionId][userId];
    }
    
    /**
     * @dev Get all voter IDs who voted in an election
     * @param electionId The ID of the election
     * @return Array of user IDs who voted
     */
    function getVotersInElection(uint256 electionId) external view returns (uint256[] memory) {
        require(elections[electionId].id != 0, "Election does not exist");
        return votersInElection[electionId];
    }
    
    /**
     * @dev Get the total number of votes cast in an election
     * @param electionId The ID of the election
     * @return The number of votes
     */
    function getVoteCount(uint256 electionId) external view returns (uint256) {
        require(elections[electionId].id != 0, "Election does not exist");
        return votersInElection[electionId].length;
    }
    
    /**
     * @dev Check if a user has voted in an election
     * @param electionId The ID of the election
     * @param userAddress The address of the user
     * @return True if the user has voted
     */
    function hasUserVoted(uint256 electionId, address userAddress) external view returns (bool) {
        uint256 userId = addressToId[userAddress];
        if (userId == 0) return false;
        return hasVoted[electionId][userId];
    }
    
    /**
     * @dev Get all private votes for an election
     * @param electionId The ID of the election
     * @return userIds Array of user IDs
     * @return signatures Array of encrypted signatures
     */
    function getAllPrivateVotes(uint256 electionId) external view returns (
        uint256[] memory userIds,
        bytes[] memory signatures
    ) {
        require(elections[electionId].id != 0, "Election does not exist");
        
        uint256[] memory voters = votersInElection[electionId];
        uint256 total = voters.length;
        
        // Initialize return arrays
        userIds = new uint256[](total);
        signatures = new bytes[](total);
        
        // Fill arrays with vote data
        for (uint256 i = 0; i < total; i++) {
            uint256 userId = voters[i];
            userIds[i] = userId;
            signatures[i] = privateVotes[electionId][userId];
        }
        
        return (userIds, signatures);
    }
    
    /**
     * @dev Get all private votes for an election with pagination
     * @param electionId The ID of the election
     * @param startIndex The starting index in the voters array
     * @param limit The maximum number of votes to return (0 for all remaining)
     * @return userIds Array of user IDs
     * @return signatures Array of encrypted signatures
     * @return total The total number of votes in the election
     */
    function getPrivateVotesBatch(
        uint256 electionId,
        uint256 startIndex,
        uint256 limit
    ) external view returns (
        uint256[] memory userIds,
        bytes[] memory signatures,
        uint256 total
    ) {
        require(elections[electionId].id != 0, "Election does not exist");
        
        uint256[] memory voters = votersInElection[electionId];
        total = voters.length;
        
        // Handle empty case
        if (total == 0 || startIndex >= total) {
            return (new uint256[](0), new bytes[](0), total);
        }
        
        // Calculate actual batch size
        uint256 remaining = total - startIndex;
        uint256 batchSize = (limit == 0 || limit > remaining) ? remaining : limit;
        
        // Initialize return arrays
        userIds = new uint256[](batchSize);
        signatures = new bytes[](batchSize);
        
        // Fill arrays with vote data
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 userId = voters[startIndex + i];
            userIds[i] = userId;
            signatures[i] = privateVotes[electionId][userId];
        }
        
        return (userIds, signatures, total);
    }
}

