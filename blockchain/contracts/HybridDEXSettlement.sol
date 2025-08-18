// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HybridDEXSettlement
 * @dev Smart contract for hybrid CEX+DEX trading settlement
 * @notice This contract handles final settlement of trades matched off-chain
 */
contract HybridDEXSettlement is ReentrancyGuard, Ownable {
    
    // ===== STRUCTS =====
    struct Trade {
        bytes32 tradeId;
        address buyer;
        address seller;
        address tokenA; // Base token
        address tokenB; // Quote token
        uint256 amountA; // Amount of base token
        uint256 amountB; // Amount of quote token (price * amountA)
        uint256 timestamp;
        bool executed;
    }
    
    struct UserBalance {
        mapping(address => uint256) tokenBalances; // token => balance
    }
    
    // ===== STATE VARIABLES =====
    mapping(bytes32 => Trade) public trades;
    mapping(address => UserBalance) private userBalances;
    mapping(address => bool) public authorizedOperators; // Backend services
    
    uint256 public constant FEE_BASIS_POINTS = 30; // 0.3% fee
    uint256 public constant BASIS_POINTS_TOTAL = 10000;
    
    address public feeRecipient;
    uint256 public totalTradesExecuted;
    
    // ===== EVENTS =====
    event TradeExecuted(
        bytes32 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 fee,
        uint256 timestamp
    );
    
    event BalanceDeposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event BalanceWithdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event OperatorAuthorized(address indexed operator, bool authorized);
    
    // ===== CONSTRUCTOR =====
    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
        authorizedOperators[msg.sender] = true;
    }
    
    // ===== MODIFIERS =====
    modifier onlyAuthorized() {
        require(authorizedOperators[msg.sender], "Not authorized");
        _;
    }
    
    // ===== TRADE EXECUTION =====
    
    /**
     * @dev Execute a matched trade between two parties
     * @param _tradeId Unique identifier for this trade
     * @param _buyer Address of the buyer
     * @param _seller Address of the seller
     * @param _tokenA Base token address
     * @param _tokenB Quote token address
     * @param _amountA Amount of base token to trade
     * @param _amountB Amount of quote token to trade
     */
    function executeTrade(
        bytes32 _tradeId,
        address _buyer,
        address _seller,
        address _tokenA,
        address _tokenB,
        uint256 _amountA,
        uint256 _amountB
    ) external onlyAuthorized nonReentrant {
        require(_buyer != address(0) && _seller != address(0), "Invalid addresses");
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token addresses");
        require(_amountA > 0 && _amountB > 0, "Invalid amounts");
        require(trades[_tradeId].tradeId == bytes32(0), "Trade already exists");
        
        // Check balances
        require(
            userBalances[_buyer].tokenBalances[_tokenB] >= _amountB,
            "Insufficient buyer balance"
        );
        require(
            userBalances[_seller].tokenBalances[_tokenA] >= _amountA,
            "Insufficient seller balance"
        );
        
        // Calculate fees
        uint256 feeA = (_amountA * FEE_BASIS_POINTS) / BASIS_POINTS_TOTAL;
        uint256 feeB = (_amountB * FEE_BASIS_POINTS) / BASIS_POINTS_TOTAL;
        
        uint256 netAmountA = _amountA - feeA;
        uint256 netAmountB = _amountB - feeB;
        
        // Execute the trade
        userBalances[_seller].tokenBalances[_tokenA] -= _amountA;
        userBalances[_buyer].tokenBalances[_tokenA] += netAmountA;
        
        userBalances[_buyer].tokenBalances[_tokenB] -= _amountB;
        userBalances[_seller].tokenBalances[_tokenB] += netAmountB;
        
        // Collect fees
        userBalances[feeRecipient].tokenBalances[_tokenA] += feeA;
        userBalances[feeRecipient].tokenBalances[_tokenB] += feeB;
        
        // Store trade record
        trades[_tradeId] = Trade({
            tradeId: _tradeId,
            buyer: _buyer,
            seller: _seller,
            tokenA: _tokenA,
            tokenB: _tokenB,
            amountA: _amountA,
            amountB: _amountB,
            timestamp: block.timestamp,
            executed: true
        });
        
        totalTradesExecuted++;
        
        emit TradeExecuted(
            _tradeId,
            _buyer,
            _seller,
            _tokenA,
            _tokenB,
            _amountA,
            _amountB,
            feeA + feeB,
            block.timestamp
        );
    }
    
    // ===== BALANCE MANAGEMENT =====
    
    /**
     * @dev Deposit tokens to user's balance
     * @param _token Token address
     * @param _amount Amount to deposit
     */
    function deposit(address _token, uint256 _amount) external nonReentrant {
        require(_token != address(0), "Invalid token");
        require(_amount > 0, "Invalid amount");
        
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        userBalances[msg.sender].tokenBalances[_token] += _amount;
        
        emit BalanceDeposited(msg.sender, _token, _amount);
    }
    
    /**
     * @dev Withdraw tokens from user's balance
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function withdraw(address _token, uint256 _amount) external nonReentrant {
        require(_token != address(0), "Invalid token");
        require(_amount > 0, "Invalid amount");
        require(
            userBalances[msg.sender].tokenBalances[_token] >= _amount,
            "Insufficient balance"
        );
        
        userBalances[msg.sender].tokenBalances[_token] -= _amount;
        IERC20(_token).transfer(msg.sender, _amount);
        
        emit BalanceWithdrawn(msg.sender, _token, _amount);
    }
    
    /**
     * @dev Batch deposit multiple tokens
     * @param _tokens Array of token addresses
     * @param _amounts Array of amounts to deposit
     */
    function batchDeposit(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external nonReentrant {
        require(_tokens.length == _amounts.length, "Array length mismatch");
        
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "Invalid token");
            require(_amounts[i] > 0, "Invalid amount");
            
            IERC20(_tokens[i]).transferFrom(msg.sender, address(this), _amounts[i]);
            userBalances[msg.sender].tokenBalances[_tokens[i]] += _amounts[i];
            
            emit BalanceDeposited(msg.sender, _tokens[i], _amounts[i]);
        }
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Get user's balance for a specific token
     * @param _user User address
     * @param _token Token address
     * @return User's token balance
     */
    function getBalance(address _user, address _token) external view returns (uint256) {
        return userBalances[_user].tokenBalances[_token];
    }
    
    /**
     * @dev Get multiple token balances for a user
     * @param _user User address
     * @param _tokens Array of token addresses
     * @return balances Array of token balances
     */
    function getBalances(
        address _user,
        address[] calldata _tokens
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](_tokens.length);
        for (uint256 i = 0; i < _tokens.length; i++) {
            balances[i] = userBalances[_user].tokenBalances[_tokens[i]];
        }
    }
    
    /**
     * @dev Get trade details
     * @param _tradeId Trade identifier
     * @return Trade struct
     */
    function getTrade(bytes32 _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }
    
    // ===== ADMIN FUNCTIONS =====
    
    /**
     * @dev Authorize/unauthorize an operator
     * @param _operator Operator address
     * @param _authorized Authorization status
     */
    function setOperatorAuthorization(
        address _operator,
        bool _authorized
    ) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        authorizedOperators[_operator] = _authorized;
        emit OperatorAuthorized(_operator, _authorized);
    }
    
    /**
     * @dev Update fee recipient
     * @param _newFeeRecipient New fee recipient address
     */
    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        require(_newFeeRecipient != address(0), "Invalid address");
        feeRecipient = _newFeeRecipient;
    }
    
    /**
     * @dev Emergency withdrawal function (owner only)
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(
        address _token,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).transfer(owner(), _amount);
    }
}