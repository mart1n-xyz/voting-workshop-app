// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {VotingWorkshop} from "../src/VotingWorkshop.sol";

contract VotingWorkshopTest is Test {
    VotingWorkshop public workshop;
    address public alice;
    address public bob;
    address public charlie;

    function setUp() public {
        workshop = new VotingWorkshop();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
    }

    function test_Register() public {
        vm.prank(alice);
        workshop.register();
        
        // Check that alice got ID 1
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.idToAddress(1), alice);
        assertEq(workshop.getTotalRegistered(), 1);
    }

    function test_RegisterMultipleUsers() public {
        // Alice registers
        vm.prank(alice);
        workshop.register();
        
        // Bob registers
        vm.prank(bob);
        workshop.register();
        
        // Charlie registers
        vm.prank(charlie);
        workshop.register();
        
        // Check IDs are assigned sequentially
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.addressToId(bob), 2);
        assertEq(workshop.addressToId(charlie), 3);
        
        // Check reverse mappings
        assertEq(workshop.idToAddress(1), alice);
        assertEq(workshop.idToAddress(2), bob);
        assertEq(workshop.idToAddress(3), charlie);
        
        assertEq(workshop.getTotalRegistered(), 3);
    }

    function test_RevertWhen_RegisteringTwice() public {
        vm.prank(alice);
        workshop.register();
        
        // Try to register again
        vm.prank(alice);
        vm.expectRevert("Already registered");
        workshop.register();
    }

    function test_IsRegistered() public {
        // Initially not registered
        assertFalse(workshop.isRegistered(alice));
        
        // Register alice
        vm.prank(alice);
        workshop.register();
        
        // Now registered
        assertTrue(workshop.isRegistered(alice));
        
        // Bob still not registered
        assertFalse(workshop.isRegistered(bob));
    }

    function test_TotalRegisteredIncrementsCorrectly() public {
        assertEq(workshop.getTotalRegistered(), 0);
        
        vm.prank(alice);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 1);
        
        vm.prank(bob);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 2);
        
        vm.prank(charlie);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 3);
    }

    function test_EventEmitted() public {
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.UserRegistered(alice, 1);
        
        vm.prank(alice);
        workshop.register();
    }

    function test_BidirectionalMapping() public {
        vm.prank(alice);
        workshop.register();
        
        vm.prank(bob);
        workshop.register();
        
        // Test address -> ID mapping
        uint256 aliceId = workshop.addressToId(alice);
        uint256 bobId = workshop.addressToId(bob);
        
        assertEq(aliceId, 1);
        assertEq(bobId, 2);
        
        // Test ID -> address mapping (reverse lookup)
        assertEq(workshop.idToAddress(aliceId), alice);
        assertEq(workshop.idToAddress(bobId), bob);
    }

    function test_UnregisteredAddressReturnsZero() public view {
        // Unregistered address should return 0
        assertEq(workshop.addressToId(alice), 0);
        assertEq(workshop.idToAddress(999), address(0));
    }

    function test_ExitRegistry() public {
        // Register alice
        vm.prank(alice);
        workshop.register();
        
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.idToAddress(1), alice);
        assertTrue(workshop.isRegistered(alice));
        
        // Exit registry
        vm.prank(alice);
        workshop.exitRegistry();
        
        // Check that mappings are cleared
        assertEq(workshop.addressToId(alice), 0);
        assertEq(workshop.idToAddress(1), address(0));
        assertFalse(workshop.isRegistered(alice));
    }

    function test_RevertWhen_ExitingWithoutRegistering() public {
        // Try to exit without registering
        vm.prank(alice);
        vm.expectRevert("Not registered");
        workshop.exitRegistry();
    }

    function test_RegisterAgainAfterExit() public {
        // Register alice
        vm.prank(alice);
        workshop.register();
        assertEq(workshop.addressToId(alice), 1);
        
        // Exit registry
        vm.prank(alice);
        workshop.exitRegistry();
        assertEq(workshop.addressToId(alice), 0);
        
        // Register again - should get a new ID
        vm.prank(alice);
        workshop.register();
        
        // Alice gets a new ID (2, since counter doesn't reset)
        assertEq(workshop.addressToId(alice), 2);
        assertEq(workshop.idToAddress(2), alice);
        assertTrue(workshop.isRegistered(alice));
    }

    function test_ExitRegistryEvent() public {
        // Register first
        vm.prank(alice);
        workshop.register();
        
        // Expect exit event
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.UserExited(alice, 1);
        
        vm.prank(alice);
        workshop.exitRegistry();
    }

    function test_MultipleUsersCanExitAndRegisterIndependently() public {
        // Alice and Bob register
        vm.prank(alice);
        workshop.register();
        
        vm.prank(bob);
        workshop.register();
        
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.addressToId(bob), 2);
        
        // Alice exits
        vm.prank(alice);
        workshop.exitRegistry();
        
        // Bob is still registered
        assertEq(workshop.addressToId(bob), 2);
        assertTrue(workshop.isRegistered(bob));
        
        // Alice is not registered
        assertFalse(workshop.isRegistered(alice));
        
        // Alice can register again
        vm.prank(alice);
        workshop.register();
        assertEq(workshop.addressToId(alice), 3); // Gets ID 3
    }

    function test_OldIdBecomesAvailableAfterExit() public {
        // Register alice
        vm.prank(alice);
        workshop.register();
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.idToAddress(1), alice);
        
        // Exit
        vm.prank(alice);
        workshop.exitRegistry();
        
        // ID 1 mapping is cleared
        assertEq(workshop.idToAddress(1), address(0));
        
        // Register Bob - he gets ID 2 (not ID 1, IDs are not reused)
        vm.prank(bob);
        workshop.register();
        assertEq(workshop.addressToId(bob), 2);
    }

    // ====== ELECTION MANAGEMENT TESTS ======

    function test_OpenNewElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        assertEq(electionId, 1);
        assertEq(workshop.getTotalElections(), 1);
        assertTrue(workshop.isElectionOpen(1));
        
        // Check election details
        VotingWorkshop.Election memory election = workshop.getElection(1);
        assertEq(election.id, 1);
        assertEq(uint(election.status), uint(VotingWorkshop.ElectionStatus.Open));
        assertFalse(election.isPublic);
        assertGt(election.openedAt, 0);
        assertEq(election.closedAt, 0);
    }

    function test_OpenPublicElection() public {
        uint256 electionId = workshop.openElection(0, true);
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertTrue(election.isPublic);
    }

    function test_OpenMultipleElections() public {
        uint256 election1 = workshop.openElection(0, false);
        uint256 election2 = workshop.openElection(0, true);
        uint256 election3 = workshop.openElection(0, false);
        
        assertEq(election1, 1);
        assertEq(election2, 2);
        assertEq(election3, 3);
        assertEq(workshop.getTotalElections(), 3);
    }

    function test_CloseElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        workshop.closeElection(electionId);
        
        assertFalse(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertEq(uint(election.status), uint(VotingWorkshop.ElectionStatus.Closed));
        assertGt(election.closedAt, 0);
    }

    function test_ReopenElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        workshop.closeElection(electionId);
        assertFalse(workshop.isElectionOpen(electionId));
        
        // Reopen the same election
        uint256 reopenedId = workshop.openElection(electionId, true); // true is ignored
        
        assertEq(reopenedId, electionId);
        assertTrue(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertFalse(election.isPublic); // Should remain false (original value)
        assertEq(election.closedAt, 0); // Reset when reopened
    }

    function test_ReopenElectionMultipleTimes() public {
        uint256 electionId = workshop.openElection(0, true);
        
        // Close and reopen multiple times
        workshop.closeElection(electionId);
        workshop.openElection(electionId, false); // false is ignored
        
        workshop.closeElection(electionId);
        workshop.openElection(electionId, false); // false is ignored
        
        assertTrue(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertTrue(election.isPublic); // Remains true from original
    }

    function test_RevertWhen_NonOwnerOpensElection() public {
        vm.prank(alice);
        vm.expectRevert();
        workshop.openElection(0, false);
    }

    function test_RevertWhen_NonOwnerClosesElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        vm.expectRevert();
        workshop.closeElection(electionId);
    }

    function test_RevertWhen_ClosingNonExistentElection() public {
        vm.expectRevert("Election does not exist");
        workshop.closeElection(999);
    }

    function test_RevertWhen_ClosingAlreadyClosedElection() public {
        uint256 electionId = workshop.openElection(0, false);
        workshop.closeElection(electionId);
        
        vm.expectRevert("Election is not open");
        workshop.closeElection(electionId);
    }

    function test_RevertWhen_ReopeningNonExistentElection() public {
        vm.expectRevert("Election does not exist");
        workshop.openElection(999, false);
    }

    function test_RevertWhen_ReopeningAlreadyOpenElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectRevert("Election is already open");
        workshop.openElection(electionId, false);
    }

    function test_ElectionOpenedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VotingWorkshop.ElectionOpened(1, false, block.timestamp);
        
        workshop.openElection(0, false);
    }

    function test_ElectionClosedEvent() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectEmit(true, false, false, true);
        emit VotingWorkshop.ElectionClosed(electionId, block.timestamp);
        
        workshop.closeElection(electionId);
    }

    // ====== PRIVATE VOTING TESTS ======

    function test_CastPrivateVote() public {
        // Setup: Register user and open private election
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false); // Private election
        
        // Cast vote
        bytes memory encryptedSig = hex"1234567890abcdef";
        vm.prank(alice);
        workshop.castPrivateVote(electionId, encryptedSig);
        
        // Check vote was recorded
        assertTrue(workshop.hasVoted(electionId, 1));
        assertTrue(workshop.hasUserVoted(electionId, alice));
        assertEq(workshop.getVoteCount(electionId), 1);
    }

    function test_CastMultiplePrivateVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // All users vote
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        assertEq(workshop.getVoteCount(electionId), 3);
    }

    function test_RevertWhen_VotingInNonExistentElection() public {
        vm.prank(alice);
        workshop.register();
        
        vm.prank(alice);
        vm.expectRevert("Election does not exist");
        workshop.castPrivateVote(999, hex"1234");
    }

    function test_RevertWhen_VotingInClosedElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        workshop.closeElection(electionId);
        
        vm.prank(alice);
        vm.expectRevert("Election is not open");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_VotingInPublicElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true); // Public election
        
        vm.prank(alice);
        vm.expectRevert("Election is not private");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_UnregisteredUserVotes() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice); // Alice is not registered
        vm.expectRevert("Voter is not registered");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_VotingTwice() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // First vote succeeds
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
        
        // Second vote fails
        vm.prank(alice);
        vm.expectRevert("Already voted in this election");
        workshop.castPrivateVote(electionId, hex"5678");
    }

    function test_RevertWhen_EmptySignature() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        vm.expectRevert("Encrypted signature cannot be empty");
        workshop.castPrivateVote(electionId, hex"");
    }

    function test_PrivateVoteCastEvent() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.PrivateVoteCast(electionId, 1, block.timestamp);
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
    }

    // ====== READ FUNCTIONS TESTS ======

    function test_GetPrivateVote() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        bytes memory encryptedSig = hex"1234567890abcdef";
        vm.prank(alice);
        workshop.castPrivateVote(electionId, encryptedSig);
        
        bytes memory retrieved = workshop.getPrivateVote(electionId, 1);
        assertEq(retrieved, encryptedSig);
    }

    function test_GetVotersInElection() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        uint256[] memory voters = workshop.getVotersInElection(electionId);
        
        assertEq(voters.length, 3);
        assertEq(voters[0], 1); // Alice
        assertEq(voters[1], 2); // Bob
        assertEq(voters[2], 3); // Charlie
    }

    function test_GetAllPrivateVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aabbcc");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"ddeeff");
        
        (uint256[] memory userIds, bytes[] memory signatures) = workshop.getAllPrivateVotes(electionId);
        
        assertEq(userIds.length, 2);
        assertEq(signatures.length, 2);
        
        assertEq(userIds[0], 1);
        assertEq(userIds[1], 2);
        
        assertEq(signatures[0], hex"aabbcc");
        assertEq(signatures[1], hex"ddeeff");
    }

    function test_GetAllPrivateVotes_EmptyElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        (uint256[] memory userIds, bytes[] memory signatures) = workshop.getAllPrivateVotes(electionId);
        
        assertEq(userIds.length, 0);
        assertEq(signatures.length, 0);
    }

    function test_GetPrivateVotesBatch() public {
        // Register 5 users
        address[] memory users = new address[](5);
        for (uint i = 0; i < 5; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
            vm.prank(users[i]);
            workshop.register();
        }
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast 5 votes
        for (uint i = 0; i < 5; i++) {
            vm.prank(users[i]);
            workshop.castPrivateVote(electionId, abi.encodePacked(uint8(i)));
        }
        
        // Get first 3 votes
        (uint256[] memory userIds, bytes[] memory signatures, uint256 total) = 
            workshop.getPrivateVotesBatch(electionId, 0, 3);
        
        assertEq(total, 5);
        assertEq(userIds.length, 3);
        assertEq(signatures.length, 3);
        
        // Get next 2 votes
        (userIds, signatures, total) = workshop.getPrivateVotesBatch(electionId, 3, 3);
        
        assertEq(total, 5);
        assertEq(userIds.length, 2); // Only 2 remaining
        assertEq(signatures.length, 2);
    }

    function test_GetPrivateVotesBatch_GetAllRemaining() public {
        // Register 3 users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        // Get all with limit = 0
        (uint256[] memory userIds, bytes[] memory signatures, uint256 total) = 
            workshop.getPrivateVotesBatch(electionId, 0, 0);
        
        assertEq(total, 3);
        assertEq(userIds.length, 3);
        assertEq(signatures.length, 3);
    }

    function test_HasUserVoted() public {
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        assertFalse(workshop.hasUserVoted(electionId, alice));
        assertFalse(workshop.hasUserVoted(electionId, bob));
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
        
        assertTrue(workshop.hasUserVoted(electionId, alice));
        assertFalse(workshop.hasUserVoted(electionId, bob));
    }

    function test_HasUserVoted_UnregisteredUser() public {
        uint256 electionId = workshop.openElection(0, false);
        
        assertFalse(workshop.hasUserVoted(electionId, alice)); // Unregistered returns false
    }
}

