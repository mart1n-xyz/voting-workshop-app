"""
Voting Workshop Points Dashboard
A Streamlit application for viewing participants and their wallet addresses.
"""

import streamlit as st
import json
from web3 import Web3
from eth_account import Account
import pandas as pd
from datetime import datetime
import random

# Page configuration
st.set_page_config(
    page_title="Voting Workshop Points Dashboard",
    page_icon="⭐",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for modern styling
st.markdown("""
<style>
    /* Main container styling */
    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    
    /* Header styling */
    h1 {
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 1.5rem;
    }
    
    h2 {
        font-weight: 600;
        color: #334155;
        margin-top: 2rem;
        margin-bottom: 1rem;
    }
    
    h3 {
        font-weight: 600;
        color: #475569;
    }
    
    /* Metric styling */
    [data-testid="stMetricValue"] {
        font-size: 1.8rem;
        font-weight: 700;
    }
    
    /* Button styling */
    .stButton > button {
        border-radius: 0.5rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    /* Success/Info/Warning box styling */
    .stAlert {
        border-radius: 0.5rem;
    }
    
    /* Divider */
    hr {
        margin: 2rem 0;
        border-color: #e2e8f0;
    }
</style>
""", unsafe_allow_html=True)

# Contract configuration
CONTRACT_ADDRESS = "0x0918E5b67187400548571D372D381C4bB4B9B27b"

# Default RPC endpoint
DEFAULT_RPC_URL = "https://public.sepolia.rpc.status.network"

# Contract ABI (simplified - only the functions we need)
CONTRACT_ABI = json.loads('''[
    {
        "inputs": [],
        "name": "getTotalRegistered",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "idToAddress",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]''')

# Vote configuration (matches votesConfig.ts)
VOTE_CONFIGS = {
    "vote0": {
        "voteKey": "vote0",
        "electionId": 1,
        "type": "public",
        "title": "Training Ground",
        "isPractice": True,
        "options": [
            {"id": 1, "text": "Feeling Messi-level productive today"},
            {"id": 2, "text": "Surviving on empanadas and wine"},
            {"id": 3, "text": "Could use a siesta."},
            {"id": 4, "text": "Like the Buenos Aires weather - a bit unpredictable"},
        ],
    },
    "vote1a": {
        "voteKey": "vote1a",
        "electionId": 2,
        "type": "public",
        "title": "Vote 1a: Coordination",
        "options": [
            {"id": 1, "text": "District A"},
            {"id": 2, "text": "District B"},
            {"id": 3, "text": "District C"},
            {"id": 4, "text": "District D"},
        ],
    },
    "vote1b": {
        "voteKey": "vote1b",
        "electionId": 3,
        "type": "private",
        "title": "Vote 1b: Private Coordination",
        "options": [
            {"id": 1, "text": "District A"},
            {"id": 2, "text": "District B"},
            {"id": 3, "text": "District C"},
            {"id": 4, "text": "District D"},
        ],
    },
    "vote2a": {
        "voteKey": "vote2a",
        "electionId": 4,
        "type": "public",
        "title": "Vote 2a: Strategic Initiative - Round 1 (Public)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2b": {
        "voteKey": "vote2b",
        "electionId": 5,
        "type": "public",
        "title": "Vote 2b: Strategic Initiative - Round 2 (Public)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2c": {
        "voteKey": "vote2c",
        "electionId": 6,
        "type": "private",
        "title": "Vote 2c: Strategic Initiative - Round 3 (Private)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2d": {
        "voteKey": "vote2d",
        "electionId": 7,
        "type": "private",
        "title": "Vote 2d: Strategic Initiative - Round 4 (Final, Private)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone, bonus if ≥50%)"},
        ],
    },
    "vote3": {
        "voteKey": "vote3",
        "electionId": 8,
        "type": "public",
        "title": "Vote 3: Merit vs Luck",
        "options": [
            {"id": 1, "text": "Award to current 3rd place participant"},
            {"id": 2, "text": "Random draw among all participants"},
        ],
    },
}

# Initialize session state
if 'web3' not in st.session_state:
    st.session_state.web3 = None
if 'account' not in st.session_state:
    st.session_state.account = None
if 'contract' not in st.session_state:
    st.session_state.contract = None
if 'last_refresh' not in st.session_state:
    st.session_state.last_refresh = None
if 'participants_data' not in st.session_state:
    st.session_state.participants_data = None
if 'vote_data' not in st.session_state:
    st.session_state.vote_data = {}  # Store uploaded vote data by vote key

def initialize_web3(rpc_url: str, private_key: str):
    """Initialize Web3 connection and account"""
    try:
        with st.spinner("Connecting to blockchain..."):
            # Connect to blockchain with timeout settings
            from web3.providers import HTTPProvider
            from web3 import Web3 as Web3Class
            
            provider = HTTPProvider(
                rpc_url,
                request_kwargs={
                    'timeout': 5  # 5 second timeout per request
                }
            )
            w3 = Web3Class(provider)
            
            # Add POA middleware for compatibility
            try:
                from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            except ImportError:
                pass
            
            if not w3.is_connected():
                st.error("❌ Failed to connect to blockchain")
                return False
            
            # Load account from private key
            if not private_key.startswith('0x'):
                private_key = '0x' + private_key
            
            account = Account.from_key(private_key)
            
            # Initialize contract
            contract = w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACT_ADDRESS),
                abi=CONTRACT_ABI
            )
            
            # Store in session state
            st.session_state.web3 = w3
            st.session_state.account = account
            st.session_state.contract = contract
            st.session_state.last_refresh = datetime.now()
            
            return True
    except Exception as e:
        st.error(f"❌ Error initializing Web3: {str(e)}")
        return False

def load_participants():
    """Load all participants and their wallet addresses from the contract"""
    try:
        contract = st.session_state.contract
        
        with st.spinner("Loading participants..."):
            # Get total number of registered users
            total_registered = contract.functions.getTotalRegistered().call()
            
            if total_registered == 0:
                return pd.DataFrame(columns=['User ID', 'Wallet Address'])
            
            # Fetch all participant addresses
            participants = []
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            for user_id in range(1, total_registered + 1):
                try:
                    # Update progress
                    progress = (user_id - 1) / total_registered
                    progress_bar.progress(progress)
                    status_text.text(f"Loading participant {user_id}/{total_registered}...")
                    
                    # Get address for this user ID
                    address = contract.functions.idToAddress(user_id).call()
                    
                    # Only add if address is not zero (valid registration)
                    if address and address != '0x0000000000000000000000000000000000000000':
                        participants.append({
                            'User ID': user_id,
                            'Wallet Address': address
                        })
                except Exception as e:
                    # Skip invalid user IDs
                    continue
            
            progress_bar.progress(1.0)
            status_text.empty()
            progress_bar.empty()
            
            # Create DataFrame
            df = pd.DataFrame(participants)
            
            # Store in session state
            st.session_state.participants_data = df
            st.session_state.last_refresh = datetime.now()
            
            return df
            
    except Exception as e:
        st.error(f"❌ Error loading participants: {str(e)}")
        return None

def parse_vote_csv(uploaded_file, vote_config):
    """Parse uploaded CSV file for vote data"""
    try:
        df = pd.read_csv(uploaded_file)
        
        # Check if it's a public or private vote format
        if 'Vote Text' in df.columns:
            # Private vote format: User ID, Choice, Vote Text
            required_cols = ['User ID', 'Choice']
        else:
            # Public vote format: User ID, Choice
            required_cols = ['User ID', 'Choice']
        
        # Validate required columns
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"Missing required column: {col}")
        
        # Validate User ID column
        if not pd.api.types.is_numeric_dtype(df['User ID']):
            df['User ID'] = pd.to_numeric(df['User ID'], errors='coerce')
        
        # Remove rows with invalid User IDs
        df = df.dropna(subset=['User ID'])
        df['User ID'] = df['User ID'].astype(int)
        
        # Validate Choice column matches vote options
        valid_choices = [opt['text'] for opt in vote_config['options']]
        invalid_choices = df[~df['Choice'].isin(valid_choices)]
        
        if len(invalid_choices) > 0:
            st.warning(f"⚠️ Found {len(invalid_choices)} invalid choices. They will be excluded.")
            df = df[df['Choice'].isin(valid_choices)]
        
        return df
        
    except Exception as e:
        st.error(f"❌ Error parsing CSV: {str(e)}")
        return None

def get_assigned_district(wallet_address: str, seed: str = "default") -> str:
    """
    Get assigned district for a wallet address (deterministic)
    Uses simple hash to assign districts A, B, C, or D with equal probability
    Matches the TypeScript implementation in votesConfig.ts
    
    Args:
        wallet_address: The wallet address to assign a district to
        seed: Optional seed for different assignments (e.g., "vote1a", "vote1b")
    
    Returns:
        District letter: "A", "B", "C", or "D"
    """
    # Simple hash: sum of character codes with seed
    hash_value = 0
    normalized = wallet_address.lower()
    input_str = normalized + seed  # Combine address and seed for different assignments
    
    for char in input_str:
        hash_value = (hash_value * 31 + ord(char)) & 0xFFFFFFFF  # >>> 0 equivalent in Python
    
    # Map to districts A, B, C, D (0-3)
    district_index = hash_value % 4
    districts = ['A', 'B', 'C', 'D']
    
    return districts[district_index]

def get_assigned_committee(wallet_address: str) -> str:
    """
    Get assigned committee for a wallet address (deterministic)
    Uses simple hash to assign one of three committees with equal probability
    Matches the TypeScript implementation in votesConfig.ts
    
    Args:
        wallet_address: The wallet address to assign a committee to
    
    Returns:
        Committee name: "Marketing", "Operations", or "Community"
    """
    # Simple hash: sum of character codes
    hash_value = 0
    normalized = wallet_address.lower()
    input_str = normalized + "committee"  # Add seed for committee assignment
    
    for char in input_str:
        hash_value = (hash_value * 31 + ord(char)) & 0xFFFFFFFF  # >>> 0 equivalent in Python
    
    # Map to committees (0-2) - equal probability
    committee_index = hash_value % 3
    committees = ['Marketing', 'Operations', 'Community']
    
    return committees[committee_index]

def calculate_vote_results(vote_df, vote_config, participants_df):
    """Calculate vote results and match with participants"""
    if vote_df is None or len(vote_df) == 0:
        return None
    
    # Merge with participants to get wallet addresses
    results_df = vote_df.merge(
        participants_df,
        on='User ID',
        how='left'
    )
    
    # Count votes per option
    vote_counts = results_df['Choice'].value_counts().to_dict()
    
    # Find winner(s)
    if len(vote_counts) > 0:
        max_votes = max(vote_counts.values())
        winners = [choice for choice, count in vote_counts.items() if count == max_votes]
    else:
        winners = []
        max_votes = 0
    
    return {
        'results_df': results_df,
        'vote_counts': vote_counts,
        'winners': winners,
        'max_votes': max_votes,
        'total_votes': len(results_df)
    }

def calculate_vote1a_points(results_df, participants_df):
    """
    Calculate points for Vote 1a based on the payoff structure:
    - Each vote for a district gives 6 points to every voter who lives in that district
    - If a district gets ≥60%:
      - School opens in that district
      - ALL voters who voted for that district get a 50-point bonus
      - Other districts get doubled rewards (12 points per vote instead of 6)
    """
    if results_df is None or len(results_df) == 0:
        return None
    
    # Extract district from choice (e.g., "District A" -> "A")
    def extract_district(choice):
        if 'District' in choice:
            parts = choice.split()
            if len(parts) >= 2:
                return parts[1]  # Returns "A", "B", "C", or "D"
        return None
    
    # Add district voted column
    results_df = results_df.copy()
    results_df['District Voted'] = results_df['Choice'].apply(extract_district)
    
    # Add assigned district for each participant (using vote1a seed)
    results_df['Assigned District'] = results_df['Wallet Address'].apply(
        lambda addr: get_assigned_district(addr, "vote1a") if pd.notna(addr) else None
    )
    
    # Calculate total votes and percentages per district
    total_votes = len(results_df)
    district_vote_counts = results_df['District Voted'].value_counts().to_dict()
    
    # Find district(s) with ≥60% (school district)
    school_districts = []
    for district, count in district_vote_counts.items():
        percentage = (count / total_votes * 100) if total_votes > 0 else 0
        if percentage >= 60:
            school_districts.append(district)
    
    # Initialize points for all participants
    # We need to calculate points for ALL participants, not just voters
    points_df = participants_df.copy()
    points_df['Assigned District'] = points_df['Wallet Address'].apply(
        lambda addr: get_assigned_district(addr, "vote1a") if pd.notna(addr) else None
    )
    points_df['Base Points'] = 0
    points_df['Bonus Points'] = 0
    points_df['Total Points'] = 0
    
    # Calculate points per district
    for voted_district in ['A', 'B', 'C', 'D']:
        votes_for_district = district_vote_counts.get(voted_district, 0)
        if votes_for_district == 0:
            continue
        
        is_school_district = voted_district in school_districts
        has_school = len(school_districts) > 0
        
        # Determine points per vote
        if is_school_district:
            # School district: 6 points per vote
            points_per_vote = 6
        elif has_school:
            # Non-school district with school: 12 points per vote (doubled)
            points_per_vote = 12
        else:
            # No school district: 6 points per vote
            points_per_vote = 6
        
        # Give points to all residents of the voted district
        district_residents = points_df[points_df['Assigned District'] == voted_district]
        for idx in district_residents.index:
            points_df.loc[idx, 'Base Points'] += points_per_vote * votes_for_district
    
    # Calculate bonuses for school district backers
    # ALL voters who voted for a school district (≥60%) get the 50-point bonus
    if school_districts:
        for school_district in school_districts:
            # Get all votes for this school district
            school_votes = results_df[results_df['District Voted'] == school_district]
            
            # ALL voters who voted for the school district get the bonus
            for _, vote_row in school_votes.iterrows():
                user_id = vote_row['User ID']
                # Find participant and add bonus
                participant_idx = points_df.index[points_df['User ID'] == user_id].tolist()
                if participant_idx:
                    points_df.loc[participant_idx[0], 'Bonus Points'] = 50
    
    # Calculate total points
    points_df['Total Points'] = points_df['Base Points'] + points_df['Bonus Points']
    
    # Create summary
    summary = {
        'school_districts': school_districts,
        'district_vote_counts': district_vote_counts,
        'total_votes': total_votes,
        'points_df': points_df
    }
    
    return summary

def calculate_vote1b_points(results_df, participants_df):
    """
    Calculate points for Vote 1b based on the payoff structure (same as Vote 1a):
    - Each vote for a district gives 6 points to every voter who lives in that district
    - If a district gets ≥60%:
      - School opens in that district
      - ALL voters who voted for that district get a 50-point bonus
      - Other districts get doubled rewards (12 points per vote instead of 6)
    Uses vote1b seed for district assignment (assignedDistrict1b).
    """
    if results_df is None or len(results_df) == 0:
        return None
    
    # Extract district from choice (e.g., "District A" -> "A")
    def extract_district(choice):
        if 'District' in choice:
            parts = choice.split()
            if len(parts) >= 2:
                return parts[1]  # Returns "A", "B", "C", or "D"
        return None
    
    # Add district voted column
    results_df = results_df.copy()
    results_df['District Voted'] = results_df['Choice'].apply(extract_district)
    
    # Add assigned district for each participant (using vote1b seed)
    results_df['Assigned District'] = results_df['Wallet Address'].apply(
        lambda addr: get_assigned_district(addr, "vote1b") if pd.notna(addr) else None
    )
    
    # Calculate total votes and percentages per district
    total_votes = len(results_df)
    district_vote_counts = results_df['District Voted'].value_counts().to_dict()
    
    # Find district(s) with ≥60% (school district)
    school_districts = []
    for district, count in district_vote_counts.items():
        percentage = (count / total_votes * 100) if total_votes > 0 else 0
        if percentage >= 60:
            school_districts.append(district)
    
    # Initialize points for all participants
    # We need to calculate points for ALL participants, not just voters
    points_df = participants_df.copy()
    points_df['Assigned District'] = points_df['Wallet Address'].apply(
        lambda addr: get_assigned_district(addr, "vote1b") if pd.notna(addr) else None
    )
    points_df['Base Points'] = 0
    points_df['Bonus Points'] = 0
    points_df['Total Points'] = 0
    
    # Calculate points per district
    for voted_district in ['A', 'B', 'C', 'D']:
        votes_for_district = district_vote_counts.get(voted_district, 0)
        if votes_for_district == 0:
            continue
        
        is_school_district = voted_district in school_districts
        has_school = len(school_districts) > 0
        
        # Determine points per vote
        if is_school_district:
            # School district: 6 points per vote
            points_per_vote = 6
        elif has_school:
            # Non-school district with school: 12 points per vote (doubled)
            points_per_vote = 12
        else:
            # No school district: 6 points per vote
            points_per_vote = 6
        
        # Give points to all residents of the voted district
        district_residents = points_df[points_df['Assigned District'] == voted_district]
        for idx in district_residents.index:
            points_df.loc[idx, 'Base Points'] += points_per_vote * votes_for_district
    
    # Calculate bonuses for school district backers
    # ALL voters who voted for a school district (≥60%) get the 50-point bonus
    if school_districts:
        for school_district in school_districts:
            # Get all votes for this school district
            school_votes = results_df[results_df['District Voted'] == school_district]
            
            # ALL voters who voted for the school district get the bonus
            for _, vote_row in school_votes.iterrows():
                user_id = vote_row['User ID']
                # Find participant and add bonus
                participant_idx = points_df.index[points_df['User ID'] == user_id].tolist()
                if participant_idx:
                    points_df.loc[participant_idx[0], 'Bonus Points'] = 50
    
    # Calculate total points
    points_df['Total Points'] = points_df['Base Points'] + points_df['Bonus Points']
    
    # Create summary
    summary = {
        'school_districts': school_districts,
        'district_vote_counts': district_vote_counts,
        'total_votes': total_votes,
        'points_df': points_df
    }
    
    return summary

def calculate_vote2_points(results_df, participants_df, vote_key):
    """
    Calculate points for Votes 2a-2d based on the payoff structure:
    - A – Citywide Campaign: 18 points to Marketing, 3 to others
    - B – Process Upgrade: 18 points to Operations, 3 to others
    - C – Community Program: 18 points to Community, 3 to others
    - D – Shared Hub: 12 points to all voters
    - D with ≥50% in vote2d: 20 points (12+8 bonus) to D voters only
    
    Args:
        results_df: DataFrame with vote results
        participants_df: DataFrame with all participants
        vote_key: The vote key ('vote2a', 'vote2b', 'vote2c', or 'vote2d')
    """
    if results_df is None or len(results_df) == 0:
        return None
    
    # Extract initiative from choice (e.g., "A – Citywide Campaign (Marketing)" -> "A")
    def extract_initiative(choice):
        if choice.startswith('A'):
            return 'A'
        elif choice.startswith('B'):
            return 'B'
        elif choice.startswith('C'):
            return 'C'
        elif choice.startswith('D'):
            return 'D'
        return None
    
    # Add initiative voted column
    results_df = results_df.copy()
    results_df['Initiative Voted'] = results_df['Choice'].apply(extract_initiative)
    
    # Add assigned committee for each participant (same for all rounds 2a-2d)
    results_df['Assigned Committee'] = results_df['Wallet Address'].apply(
        lambda addr: get_assigned_committee(addr) if pd.notna(addr) else None
    )
    
    # Calculate total votes and percentages per initiative
    total_votes = len(results_df)
    initiative_vote_counts = results_df['Initiative Voted'].value_counts().to_dict()
    
    # Check if D reached 50% threshold (only for vote2d)
    is_vote2d = vote_key == 'vote2d'
    d_threshold_met = False
    if is_vote2d:
        d_votes = initiative_vote_counts.get('D', 0)
        d_percentage = (d_votes / total_votes * 100) if total_votes > 0 else 0
        d_threshold_met = d_percentage >= 50
    
    # Initialize points for all participants
    points_df = participants_df.copy()
    points_df['Assigned Committee'] = points_df['Wallet Address'].apply(
        lambda addr: get_assigned_committee(addr) if pd.notna(addr) else None
    )
    points_df['Points'] = 0
    
    # Calculate points for each vote
    for _, vote_row in results_df.iterrows():
        user_id = vote_row['User ID']
        initiative = vote_row['Initiative Voted']
        committee = vote_row['Assigned Committee']
        
        if initiative is None or committee is None:
            continue
        
        # Find participant
        participant_idx = points_df.index[points_df['User ID'] == user_id].tolist()
        if not participant_idx:
            continue
        
        participant_idx = participant_idx[0]
        participant_committee = points_df.loc[participant_idx, 'Assigned Committee']
        
        # Calculate points based on initiative and committee
        if initiative == 'A':
            # A: 18 to Marketing, 3 to others
            points = 18 if participant_committee == 'Marketing' else 3
        elif initiative == 'B':
            # B: 18 to Operations, 3 to others
            points = 18 if participant_committee == 'Operations' else 3
        elif initiative == 'C':
            # C: 18 to Community, 3 to others
            points = 18 if participant_committee == 'Community' else 3
        elif initiative == 'D':
            # D: 12 to all, or 20 (12+8) if threshold met in vote2d
            if is_vote2d and d_threshold_met:
                points = 20  # 12 base + 8 bonus
            else:
                points = 12
        else:
            points = 0
        
        points_df.loc[participant_idx, 'Points'] = points
    
    # Create summary
    summary = {
        'initiative_vote_counts': initiative_vote_counts,
        'total_votes': total_votes,
        'd_threshold_met': d_threshold_met,
        'points_df': points_df
    }
    
    return summary

# Main UI
st.title("⭐ Voting Workshop Points Dashboard")

# Connection section
if not st.session_state.account:
    st.subheader("🔌 Connect to Blockchain")
    
    col1, col2 = st.columns([2, 2])
    
    with col1:
        # Try to load from secrets first
        try:
            default_rpc = st.secrets.get("RPC_ENDPOINT", DEFAULT_RPC_URL)
        except:
            default_rpc = DEFAULT_RPC_URL
        
        rpc_url = st.text_input(
            "RPC URL",
            value=default_rpc,
            type="default",
            help="Blockchain RPC endpoint"
        )
    
    with col2:
        private_key = st.text_input(
            "Wallet Private Key",
            type="password",
            help="Your wallet private key"
        )
    
    if st.button("🔌 Connect", type="primary", width='content'):
        if not private_key:
            st.error("Please enter your wallet private key")
        else:
            if initialize_web3(rpc_url, private_key):
                st.success(f"✅ Connected!")
                st.rerun()
    
    st.divider()
    st.caption(f"Contract: {CONTRACT_ADDRESS} | Network: Status Sepolia")

else:
    # Connected status bar
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    
    with col1:
        st.success(f"✅ Connected: {st.session_state.account.address[:10]}...{st.session_state.account.address[-8:]}")
    
    with col2:
        st.caption(f"Network: Status Sepolia")
    
    with col3:
        if st.session_state.last_refresh:
            st.caption(f"Last refresh: {st.session_state.last_refresh.strftime('%H:%M:%S')}")
    
    with col4:
        if st.button("🔄 Refresh", width='stretch'):
            st.session_state.participants_data = None
            st.session_state.last_refresh = datetime.now()
            st.rerun()
    
    st.divider()
    
    # Main content area
    st.header("👥 Participants")
    
    # Load participants if not already loaded or if refresh was requested
    if st.session_state.participants_data is None:
        participants_df = load_participants()
    else:
        participants_df = st.session_state.participants_data
    
    if participants_df is not None and len(participants_df) > 0:
        # Display summary metrics
        col1, col2 = st.columns(2)
        
        with col1:
            st.metric("Total Participants", len(participants_df))
        
        with col2:
            st.metric("Status", "✅ Loaded")
        
        st.divider()
        
        # Display participants table
        st.subheader("📋 Participant List")
        
        # Format wallet addresses for better readability
        display_df = participants_df.copy()
        display_df['Wallet Address'] = display_df['Wallet Address'].apply(
            lambda x: f"{x[:6]}...{x[-4:]}" if len(x) > 10 else x
        )
        
        # Display table with full addresses on hover
        st.dataframe(
            participants_df,
            width='stretch',
            hide_index=True,
            height=min(600, 50 + len(participants_df) * 40),
            column_config={
                "User ID": st.column_config.NumberColumn(
                    "User ID",
                    help="Sequential ID assigned during registration",
                    width="small"
                ),
                "Wallet Address": st.column_config.TextColumn(
                    "Wallet Address",
                    help="Ethereum wallet address of the participant",
                    width="large"
                )
            }
        )
        
        # Download button
        csv = participants_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Participants (CSV)",
            data=csv,
            file_name=f"participants_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            width='stretch'
        )
        
    elif participants_df is not None and len(participants_df) == 0:
        st.info("📭 No participants registered yet.")
    else:
        st.warning("⚠️ Failed to load participants. Please try refreshing.")
    
    # Vote sections
    if participants_df is not None and len(participants_df) > 0:
        st.divider()
        st.header("🗳️ Vote Data Upload")
        st.caption("Upload CSV files exported from the backup dashboard for each vote")
        
        # Filter out vote0 (Training Ground) and vote3 (Merit vs Luck)
        scored_votes = {
            vote_key: vote_config 
            for vote_key, vote_config in VOTE_CONFIGS.items() 
            if vote_key not in ['vote0', 'vote3']
        }
        
        # Create tabs for scored votes only
        vote_tabs = st.tabs([config['title'] for config in scored_votes.values()])
        
        for tab_idx, (vote_key, vote_config) in enumerate(scored_votes.items()):
            with vote_tabs[tab_idx]:
                st.subheader(f"{vote_config['title']} (Election ID: {vote_config['electionId']})")
                
                # Display vote info
                col1, col2 = st.columns(2)
                with col1:
                    vote_type_icon = "👁️" if vote_config['type'] == 'public' else "🔐"
                    st.caption(f"**Type:** {vote_type_icon} {vote_config['type'].title()}")
                with col2:
                    if vote_config.get('isPractice', False):
                        st.caption("**Practice Vote** (no points)")
                    else:
                        st.caption("**Scored Vote**")
                
                # CSV upload section
                st.markdown("### 📤 Upload Vote Data")
                
                uploaded_file = st.file_uploader(
                    f"Upload CSV file for {vote_config['title']}",
                    type=['csv'],
                    key=f"upload_{vote_key}",
                    help=f"Upload a CSV file exported from backup dashboard. Expected format: 'User ID,Choice' for public votes or 'User ID,Choice,Vote Text' for private votes."
                )
                
                # Process uploaded file
                if uploaded_file is not None:
                    vote_df = parse_vote_csv(uploaded_file, vote_config)
                    
                    if vote_df is not None and len(vote_df) > 0:
                        # Store in session state
                        st.session_state.vote_data[vote_key] = vote_df
                        
                        st.success(f"✅ Successfully loaded {len(vote_df)} votes!")
                        
                        # Calculate and display results
                        results = calculate_vote_results(vote_df, vote_config, participants_df)
                        
                        if results:
                            st.divider()
                            st.markdown("### 📊 Vote Results")
                            
                            # Display summary metrics
                            col1, col2, col3 = st.columns(3)
                            with col1:
                                st.metric("Total Votes", results['total_votes'])
                            with col2:
                                st.metric("Unique Voters", len(results['results_df']['User ID'].unique()))
                            with col3:
                                if len(results['winners']) == 1:
                                    st.metric("Winner", results['winners'][0])
                                else:
                                    st.metric("Tie", f"{len(results['winners'])} options")
                            
                            # Display vote counts
                            st.markdown("#### Vote Distribution")
                            vote_counts_df = pd.DataFrame({
                                'Option': list(results['vote_counts'].keys()),
                                'Votes': list(results['vote_counts'].values())
                            })
                            vote_counts_df = vote_counts_df.sort_values('Votes', ascending=False)
                            vote_counts_df['Percentage'] = (vote_counts_df['Votes'] / results['total_votes'] * 100).round(1)
                            
                            st.dataframe(
                                vote_counts_df,
                                width='stretch',
                                hide_index=True,
                                column_config={
                                    "Option": st.column_config.TextColumn("Option", width="large"),
                                    "Votes": st.column_config.NumberColumn("Votes", width="small"),
                                    "Percentage": st.column_config.NumberColumn("Percentage (%)", width="small", format="%.1f")
                                }
                            )
                            
                            # Display individual votes
                            st.markdown("#### Individual Votes")
                            st.dataframe(
                                results['results_df'][['User ID', 'Wallet Address', 'Choice']],
                                width='stretch',
                                hide_index=True,
                                height=min(400, 50 + len(results['results_df']) * 35),
                                column_config={
                                    "User ID": st.column_config.NumberColumn("User ID", width="small"),
                                    "Wallet Address": st.column_config.TextColumn("Wallet Address", width="medium"),
                                    "Choice": st.column_config.TextColumn("Choice", width="large")
                                }
                            )
                            
                            # Download processed results
                            csv = results['results_df'][['User ID', 'Wallet Address', 'Choice']].to_csv(index=False)
                            st.download_button(
                                label=f"📥 Download Processed Results (CSV)",
                                data=csv,
                                file_name=f"{vote_key}_processed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                                mime="text/csv",
                                key=f"download_{vote_key}",
                                width='stretch'
                            )
                            
                            # Points calculation for Vote 1a, 1b, and 2a-2d
                            if vote_key in ['vote1a', 'vote1b', 'vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                st.divider()
                                st.markdown("### ⭐ Points Calculation")
                                
                                # Use appropriate calculation function based on vote
                                if vote_key == 'vote1a':
                                    points_summary = calculate_vote1a_points(results['results_df'], participants_df)
                                elif vote_key == 'vote1b':
                                    points_summary = calculate_vote1b_points(results['results_df'], participants_df)
                                elif vote_key in ['vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                    points_summary = calculate_vote2_points(results['results_df'], participants_df, vote_key)
                                else:
                                    points_summary = None
                                
                                if points_summary:
                                    # Handle votes 1a/1b (district-based)
                                    if vote_key in ['vote1a', 'vote1b']:
                                        # Display school district status
                                        if points_summary['school_districts']:
                                            st.success(f"🏫 **School District(s):** {', '.join([f'District {d}' for d in points_summary['school_districts']])}")
                                            st.caption("A programming school will be opened in the district(s) with ≥60% of votes")
                                        else:
                                            st.info("ℹ️ No district reached 60% threshold - no school will be opened")
                                        
                                        # Display district vote summary
                                        st.markdown("#### District Vote Summary")
                                        district_summary_data = []
                                        for district in ['A', 'B', 'C', 'D']:
                                            votes = points_summary['district_vote_counts'].get(district, 0)
                                            percentage = (votes / points_summary['total_votes'] * 100) if points_summary['total_votes'] > 0 else 0
                                            is_school = district in points_summary['school_districts']
                                            district_summary_data.append({
                                                'District': district,
                                                'Votes': votes,
                                                'Percentage': f"{percentage:.1f}%",
                                                'Status': '🏫 School District' if is_school else 'Regular District'
                                            })
                                        
                                        district_summary_df = pd.DataFrame(district_summary_data)
                                        st.dataframe(district_summary_df, hide_index=True, width='stretch')
                                        
                                        # Display points leaderboard
                                        st.markdown("#### Points Leaderboard")
                                        points_display_df = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned District', 'Base Points', 'Bonus Points', 'Total Points']].copy()
                                        points_display_df = points_display_df.sort_values('Total Points', ascending=False)
                                        
                                        # Format wallet addresses for display
                                        points_display_df['Wallet Address'] = points_display_df['Wallet Address'].apply(
                                            lambda x: f"{x[:6]}...{x[-4:]}" if pd.notna(x) and len(str(x)) > 10 else x
                                        )
                                        
                                        st.dataframe(
                                            points_display_df,
                                            width='stretch',
                                            hide_index=True,
                                            height=min(600, 50 + len(points_display_df) * 40),
                                            column_config={
                                                "User ID": st.column_config.NumberColumn("User ID", width="small"),
                                                "Wallet Address": st.column_config.TextColumn("Wallet Address", width="medium"),
                                                "Assigned District": st.column_config.TextColumn("District", width="small"),
                                                "Base Points": st.column_config.NumberColumn("Base Points", width="small"),
                                                "Bonus Points": st.column_config.NumberColumn("Bonus Points", width="small"),
                                                "Total Points": st.column_config.NumberColumn("Total Points", width="small", format="%d")
                                            }
                                        )
                                        
                                        # Download points data
                                        points_csv = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned District', 'Base Points', 'Bonus Points', 'Total Points']].to_csv(index=False)
                                    
                                    # Handle votes 2a-2d (committee-based)
                                    elif vote_key in ['vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                        # Display D threshold status for vote2d
                                        if vote_key == 'vote2d':
                                            if points_summary['d_threshold_met']:
                                                st.success(f"🎁 **Shared Hub Bonus Activated!** D received ≥50% of votes")
                                                st.caption("All D voters receive 20 points (12 base + 8 bonus)")
                                            else:
                                                st.info("ℹ️ D did not reach 50% threshold - no bonus activated")
                                        
                                        # Display initiative vote summary
                                        st.markdown("#### Initiative Vote Summary")
                                        initiative_summary_data = []
                                        initiative_labels = {
                                            'A': 'A – Citywide Campaign (Marketing)',
                                            'B': 'B – Process Upgrade (Operations)',
                                            'C': 'C – Community Program (Community)',
                                            'D': 'D – Shared Hub'
                                        }
                                        for initiative in ['A', 'B', 'C', 'D']:
                                            votes = points_summary['initiative_vote_counts'].get(initiative, 0)
                                            percentage = (votes / points_summary['total_votes'] * 100) if points_summary['total_votes'] > 0 else 0
                                            initiative_summary_data.append({
                                                'Initiative': initiative_labels[initiative],
                                                'Votes': votes,
                                                'Percentage': f"{percentage:.1f}%"
                                            })
                                        
                                        initiative_summary_df = pd.DataFrame(initiative_summary_data)
                                        st.dataframe(initiative_summary_df, hide_index=True, width='stretch')
                                        
                                        # Display points leaderboard
                                        st.markdown("#### Points Leaderboard")
                                        points_display_df = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned Committee', 'Points']].copy()
                                        points_display_df = points_display_df.sort_values('Points', ascending=False)
                                        
                                        # Format wallet addresses for display
                                        points_display_df['Wallet Address'] = points_display_df['Wallet Address'].apply(
                                            lambda x: f"{x[:6]}...{x[-4:]}" if pd.notna(x) and len(str(x)) > 10 else x
                                        )
                                        
                                        st.dataframe(
                                            points_display_df,
                                            width='stretch',
                                            hide_index=True,
                                            height=min(600, 50 + len(points_display_df) * 40),
                                            column_config={
                                                "User ID": st.column_config.NumberColumn("User ID", width="small"),
                                                "Wallet Address": st.column_config.TextColumn("Wallet Address", width="medium"),
                                                "Assigned Committee": st.column_config.TextColumn("Committee", width="medium"),
                                                "Points": st.column_config.NumberColumn("Points", width="small", format="%d")
                                            }
                                        )
                                        
                                        # Download points data
                                        points_csv = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned Committee', 'Points']].to_csv(index=False)
                                    
                                    # Download button (common for both vote types)
                                    st.download_button(
                                        label="📥 Download Points Data (CSV)",
                                        data=points_csv,
                                        file_name=f"{vote_key}_points_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                                        mime="text/csv",
                                        key=f"download_points_{vote_key}",
                                        width='stretch'
                                    )
                
                # Show existing data if available
                elif vote_key in st.session_state.vote_data:
                    existing_df = st.session_state.vote_data[vote_key]
                    st.info(f"📋 Using previously uploaded data: {len(existing_df)} votes")
                    
                    if st.button(f"🔄 Clear Data", key=f"clear_{vote_key}"):
                        del st.session_state.vote_data[vote_key]
                        st.rerun()
                    
                    # Display existing data
                    results = calculate_vote_results(existing_df, vote_config, participants_df)
                    if results:
                        st.markdown("### 📊 Current Results")
                        col1, col2 = st.columns(2)
                        with col1:
                            st.metric("Total Votes", results['total_votes'])
                        with col2:
                            if len(results['winners']) == 1:
                                st.metric("Winner", results['winners'][0])
                            else:
                                st.metric("Tie", f"{len(results['winners'])} options")
                        
                        # Quick summary table
                        vote_counts_df = pd.DataFrame({
                            'Option': list(results['vote_counts'].keys()),
                            'Votes': list(results['vote_counts'].values())
                        })
                        vote_counts_df = vote_counts_df.sort_values('Votes', ascending=False)
                        vote_counts_df['Percentage'] = (vote_counts_df['Votes'] / results['total_votes'] * 100).round(1)
                        st.dataframe(vote_counts_df, hide_index=True)
                        
                        # Points calculation for Vote 1a, 1b, and 2a-2d (existing data)
                        if vote_key in ['vote1a', 'vote1b', 'vote2a', 'vote2b', 'vote2c', 'vote2d']:
                            st.divider()
                            st.markdown("### ⭐ Points Calculation")
                            
                            # Use appropriate calculation function based on vote
                            if vote_key == 'vote1a':
                                points_summary = calculate_vote1a_points(results['results_df'], participants_df)
                            elif vote_key == 'vote1b':
                                points_summary = calculate_vote1b_points(results['results_df'], participants_df)
                            elif vote_key in ['vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                points_summary = calculate_vote2_points(results['results_df'], participants_df, vote_key)
                            else:
                                points_summary = None
                            
                            if points_summary:
                                # Handle votes 1a/1b (district-based)
                                if vote_key in ['vote1a', 'vote1b']:
                                    # Similar display as above for existing data
                                    st.markdown("#### Points Summary")
                                    points_display_df = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned District', 'Base Points', 'Bonus Points', 'Total Points']].copy()
                                    points_display_df = points_display_df.sort_values('Total Points', ascending=False)
                                    points_display_df['Wallet Address'] = points_display_df['Wallet Address'].apply(
                                        lambda x: f"{x[:6]}...{x[-4:]}" if pd.notna(x) and len(str(x)) > 10 else x
                                    )
                                    st.dataframe(points_display_df, hide_index=True, width='stretch')
                                    points_csv = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned District', 'Base Points', 'Bonus Points', 'Total Points']].to_csv(index=False)
                                
                                # Handle votes 2a-2d (committee-based)
                                elif vote_key in ['vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                    st.markdown("#### Points Summary")
                                    points_display_df = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned Committee', 'Points']].copy()
                                    points_display_df = points_display_df.sort_values('Points', ascending=False)
                                    points_display_df['Wallet Address'] = points_display_df['Wallet Address'].apply(
                                        lambda x: f"{x[:6]}...{x[-4:]}" if pd.notna(x) and len(str(x)) > 10 else x
                                    )
                                    st.dataframe(points_display_df, hide_index=True, width='stretch')
                                    points_csv = points_summary['points_df'][['User ID', 'Wallet Address', 'Assigned Committee', 'Points']].to_csv(index=False)
                                
                                st.download_button(
                                    label="📥 Download Points Data (CSV)",
                                    data=points_csv,
                                    file_name=f"{vote_key}_points_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                                    mime="text/csv",
                                    key=f"download_points_existing_{vote_key}",
                                    width='stretch'
                                )
                
                else:
                    st.info("💡 Upload a CSV file to view vote results. Example files are in the `example_data` folder.")
                    
                    # Show expected format
                    with st.expander("📋 Expected CSV Format"):
                        if vote_config['type'] == 'public':
                            st.code("""User ID,Choice
1,District A
2,District B
3,District C""", language="csv")
                        else:
                            st.code("""User ID,Choice,Vote Text
1,District A,I vote for District A
2,District B,I vote for District B
3,District C,I vote for District C""", language="csv")
        
        # Summary section (only show scored votes)
        scored_vote_data = {
            vote_key: vote_df 
            for vote_key, vote_df in st.session_state.vote_data.items() 
            if vote_key in scored_votes
        }
        
        if scored_vote_data:
            st.divider()
            st.header("📈 Summary")
            
            # Count votes per election
            summary_data = []
            for vote_key, vote_df in scored_vote_data.items():
                vote_config = VOTE_CONFIGS[vote_key]
                summary_data.append({
                    'Vote': vote_config['title'],
                    'Election ID': vote_config['electionId'],
                    'Type': vote_config['type'].title(),
                    'Votes Loaded': len(vote_df),
                    'Unique Voters': len(vote_df['User ID'].unique())
                })
            
            if summary_data:
                summary_df = pd.DataFrame(summary_data)
                st.dataframe(summary_df, hide_index=True, width='stretch')
        
        # Final Points Summary - Aggregate all points from all votes
        if participants_df is not None and len(participants_df) > 0:
            # Check if we have any scored votes
            scored_vote_keys = ['vote1a', 'vote1b', 'vote2a', 'vote2b', 'vote2c', 'vote2d']
            has_scored_votes = any(st.session_state.vote_data.get(key) is not None for key in scored_vote_keys)
            
            if has_scored_votes:
                st.divider()
                st.header("🏆 Final Points Summary")
                st.caption("Aggregated points from all votes")
                
                # Initialize final points dataframe
                final_points_df = participants_df.copy()
                for vote_key in scored_vote_keys:
                    final_points_df[f'{vote_key.upper()} Points'] = 0
                final_points_df['Total Points'] = 0
                
                # Calculate and add points for each vote
                for vote_key in scored_vote_keys:
                    vote_data = st.session_state.vote_data.get(vote_key)
                    if vote_data is not None:
                        results = calculate_vote_results(vote_data, VOTE_CONFIGS[vote_key], participants_df)
                        if results:
                            # Calculate points based on vote type
                            if vote_key == 'vote1a':
                                points_summary = calculate_vote1a_points(results['results_df'], participants_df)
                                points_col = 'Total Points'
                            elif vote_key == 'vote1b':
                                points_summary = calculate_vote1b_points(results['results_df'], participants_df)
                                points_col = 'Total Points'
                            elif vote_key in ['vote2a', 'vote2b', 'vote2c', 'vote2d']:
                                points_summary = calculate_vote2_points(results['results_df'], participants_df, vote_key)
                                points_col = 'Points'
                            else:
                                points_summary = None
                                points_col = None
                            
                            if points_summary:
                                # Merge points
                                for _, row in points_summary['points_df'].iterrows():
                                    user_id = row['User ID']
                                    points = row[points_col]
                                    idx = final_points_df.index[final_points_df['User ID'] == user_id].tolist()
                                    if idx:
                                        final_points_df.loc[idx[0], f'{vote_key.upper()} Points'] = points
                                        final_points_df.loc[idx[0], 'Total Points'] += points
                
                # Sort by total points
                final_points_df = final_points_df.sort_values('Total Points', ascending=False)
                
                # Format wallet addresses for display
                display_final_df = final_points_df.copy()
                display_final_df['Wallet Address'] = display_final_df['Wallet Address'].apply(
                    lambda x: f"{x[:6]}...{x[-4:]}" if pd.notna(x) and len(str(x)) > 10 else x
                )
                
                # Select columns to display (only votes that have data)
                display_columns = ['User ID', 'Wallet Address']
                for vote_key in scored_vote_keys:
                    if st.session_state.vote_data.get(vote_key) is not None:
                        display_columns.append(f'{vote_key.upper()} Points')
                display_columns.append('Total Points')
                
                # Display final leaderboard
                st.markdown("#### Final Points Leaderboard")
                st.dataframe(
                    display_final_df[display_columns],
                    width='stretch',
                    hide_index=True,
                    height=min(600, 50 + len(display_final_df) * 40),
                    column_config={
                        "User ID": st.column_config.NumberColumn("User ID", width="small"),
                        "Wallet Address": st.column_config.TextColumn("Wallet Address", width="medium"),
                        **{col: st.column_config.NumberColumn(col, width="small", format="%d") 
                           for col in display_columns if col not in ['User ID', 'Wallet Address']}
                    }
                )
                
                # Download final points data
                final_csv = final_points_df[display_columns].to_csv(index=False)
                st.download_button(
                    label="📥 Download Final Points Summary (CSV)",
                    data=final_csv,
                    file_name=f"final_points_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                    mime="text/csv",
                    key="download_final_points",
                    width='stretch'
                )
                
                # Winners Section
                st.divider()
                st.header("🏆 Winners")
                
                # Use a fixed seed for consistency
                SEED = "voting_workshop_2024"
                random.seed(SEED)
                
                # Get top 3 winners (handle ties with seeded randomness)
                # Group by total points and sort
                sorted_df = final_points_df.sort_values('Total Points', ascending=False)
                
                # Get unique point values in descending order
                unique_points = sorted_df['Total Points'].unique()
                
                top_3_winners = []
                for points_value in unique_points:
                    if len(top_3_winners) >= 3:
                        break
                    
                    # Get all participants with this point value
                    tied_participants = sorted_df[sorted_df['Total Points'] == points_value].copy()
                    
                    # If there's a tie, shuffle using seeded random
                    if len(tied_participants) > 1:
                        # Create a list of indices and shuffle with seed
                        indices = list(tied_participants.index)
                        random.shuffle(indices)
                        tied_participants = tied_participants.reindex(indices)
                    
                    # Add participants until we have 3
                    for _, row in tied_participants.iterrows():
                        if len(top_3_winners) >= 3:
                            break
                        top_3_winners.append({
                            'User ID': row['User ID'],
                            'Wallet Address': row['Wallet Address'],
                            'Total Points': row['Total Points']
                        })
                
                # Display top 3 winners
                st.markdown("#### 🥇 Top 3 Winners")
                if len(top_3_winners) > 0:
                    winners_data = []
                    medals = ['🥇', '🥈', '🥉']
                    for idx, winner in enumerate(top_3_winners):
                        winners_data.append({
                            'Rank': f"{medals[idx] if idx < 3 else ''} {idx + 1}",
                            'User ID': winner['User ID'],
                            'Wallet Address': f"{winner['Wallet Address'][:6]}...{winner['Wallet Address'][-4:]}",
                            'Total Points': winner['Total Points']
                        })
                    
                    winners_df = pd.DataFrame(winners_data)
                    st.dataframe(
                        winners_df,
                        width='stretch',
                        hide_index=True,
                        column_config={
                            "Rank": st.column_config.TextColumn("Rank", width="small"),
                            "User ID": st.column_config.NumberColumn("User ID", width="small"),
                            "Wallet Address": st.column_config.TextColumn("Wallet Address", width="medium"),
                            "Total Points": st.column_config.NumberColumn("Total Points", width="small", format="%d")
                        }
                    )
                else:
                    st.info("No winners to display")
                
                # Random participant selection (using seeded randomness)
                st.markdown("#### 🎲 Random Participant (Bonus Reward)")
                random.seed(SEED + "_random_participant")  # Different seed for random participant
                
                # Select a random participant from all participants
                all_participants = final_points_df.copy()
                if len(all_participants) > 0:
                    random_idx = random.randint(0, len(all_participants) - 1)
                    random_participant = all_participants.iloc[random_idx]
                    
                    st.success(f"**Selected Participant:**")
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("User ID", random_participant['User ID'])
                    with col2:
                        st.metric("Wallet Address", f"{random_participant['Wallet Address'][:6]}...{random_participant['Wallet Address'][-4:]}")
                    with col3:
                        st.metric("Total Points", random_participant['Total Points'])
                    
                    st.caption("This participant will receive a bonus reward regardless of their point balance.")
                else:
                    st.info("No participants available for random selection")

