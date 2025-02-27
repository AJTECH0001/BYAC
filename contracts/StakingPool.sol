// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StakingPool is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant MAINTAINER_ROLE = keccak256("MAINTAINER_ROLE");
    bytes32 public constant DEPOSITOR_ROLE = keccak256("DEPOSITOR_ROLE");

    IERC20 public immutable stakingToken;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public stakingTime;
    mapping(address => uint256) public userPoints;

    uint256 public totalSupply;
    uint256 public constant POINTS_MULTIPLIER = 1e18;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(uint256 reward);
    event PointsUpdated(address indexed user, uint256 points);

    constructor(
        address _stakingToken,
        address admin
    ) {
        stakingToken = IERC20(_stakingToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MAINTAINER_ROLE, admin);
        _grantRole(DEPOSITOR_ROLE, admin);
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * POINTS_MULTIPLIER) / totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return
            ((balanceOf[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / POINTS_MULTIPLIER) +
            rewards[account];
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        stakingTime[msg.sender] = block.timestamp;
        
        // Transfer tokens to contract
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Staked(msg.sender, amount);

        // Update points
        _updatePoints(msg.sender);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(balanceOf[msg.sender] >= amount, "Not enough staked");
        
        totalSupply -= amount;
        balanceOf[msg.sender] -= amount;
        
        // Transfer tokens back to user
        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);

        // Update points
        _updatePoints(msg.sender);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            require(stakingToken.transfer(msg.sender, reward), "Transfer failed");
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(balanceOf[msg.sender]);
        getReward();
    }

    function notifyRewardAmount(uint256 reward) external onlyRole(DEFAULT_ADMIN_ROLE) updateReward(address(0)) {
        require(reward > 0, "Reward must be greater than 0");
        rewardRate = reward;
        lastUpdateTime = block.timestamp;
        emit RewardAdded(reward);
    }

    function depositRewards(uint256 amount) external onlyRole(DEPOSITOR_ROLE) {
        require(amount > 0, "Amount must be greater than 0");
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }

    function pause() external onlyRole(MAINTAINER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(MAINTAINER_ROLE) {
        _unpause();
    }

    function _updatePoints(address user) internal {
        uint256 stakedAmount = balanceOf[user];
        uint256 stakingDuration = block.timestamp - stakingTime[user];
        
        // Points formula: staked amount * sqrt(duration in days)
        uint256 points = stakedAmount * _sqrt(stakingDuration / 1 days);
        userPoints[user] = points;
        
        emit PointsUpdated(user, points);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}