// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Voting
 * @dev A simple voting contract where users can create proposals and vote on them
 */
contract Voting {
    struct Proposal {
        string description;
        uint256 voteCount;
        uint256 createdAt;
        address creator;
        bool executed;
    }

    // Array of all proposals
    Proposal[] public proposals;
    
    // Mapping to track if an address has voted on a specific proposal
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Events
    event ProposalCreated(uint256 indexed proposalId, string description, address indexed creator);
    event Voted(uint256 indexed proposalId, address indexed voter);
    event ProposalExecuted(uint256 indexed proposalId);

    /**
     * @dev Create a new proposal
     * @param _description Description of the proposal
     */
    function createProposal(string memory _description) external returns (uint256) {
        require(bytes(_description).length > 0, "Description cannot be empty");
        
        uint256 proposalId = proposals.length;
        
        proposals.push(Proposal({
            description: _description,
            voteCount: 0,
            createdAt: block.timestamp,
            creator: msg.sender,
            executed: false
        }));
        
        emit ProposalCreated(proposalId, _description, msg.sender);
        
        return proposalId;
    }

    /**
     * @dev Vote on a proposal
     * @param _proposalId ID of the proposal to vote on
     */
    function vote(uint256 _proposalId) external {
        require(_proposalId < proposals.length, "Proposal does not exist");
        require(!hasVoted[_proposalId][msg.sender], "Already voted on this proposal");
        require(!proposals[_proposalId].executed, "Proposal already executed");
        
        hasVoted[_proposalId][msg.sender] = true;
        proposals[_proposalId].voteCount++;
        
        emit Voted(_proposalId, msg.sender);
    }

    /**
     * @dev Execute a proposal (for demonstration purposes)
     * @param _proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 _proposalId) external {
        require(_proposalId < proposals.length, "Proposal does not exist");
        require(!proposals[_proposalId].executed, "Proposal already executed");
        require(msg.sender == proposals[_proposalId].creator, "Only creator can execute");
        
        proposals[_proposalId].executed = true;
        
        emit ProposalExecuted(_proposalId);
    }

    /**
     * @dev Get the total number of proposals
     */
    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /**
     * @dev Get proposal details
     * @param _proposalId ID of the proposal
     */
    function getProposal(uint256 _proposalId) external view returns (
        string memory description,
        uint256 voteCount,
        uint256 createdAt,
        address creator,
        bool executed
    ) {
        require(_proposalId < proposals.length, "Proposal does not exist");
        
        Proposal memory proposal = proposals[_proposalId];
        return (
            proposal.description,
            proposal.voteCount,
            proposal.createdAt,
            proposal.creator,
            proposal.executed
        );
    }
}

