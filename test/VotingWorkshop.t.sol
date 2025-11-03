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

    function test_UnregisteredAddressReturnsZero() public {
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
}

