// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleDEX {
    struct Trade {
        string tradeId;
        address buyer;
        address seller;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
        bool executed;
    }
    
    mapping(string => Trade) public trades;
    uint256 public totalTradesExecuted;
    
    event TradeExecuted(
        string indexed tradeId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );
    
    constructor() {
        // Constructor može biti prazan
    }
    
    function executeTrade(
        string memory _tradeId,
        address _buyer,
        address _seller,
        uint256 _amount,
        uint256 _price
    ) external {
        require(!trades[_tradeId].executed, "Trade already executed");
        
        trades[_tradeId] = Trade({
            tradeId: _tradeId,
            buyer: _buyer,
            seller: _seller,
            amount: _amount,
            price: _price,
            timestamp: block.timestamp,
            executed: true
        });
        
        totalTradesExecuted++;
        
        emit TradeExecuted(
            _tradeId,
            _buyer,
            _seller,
            _amount,
            _price,
            block.timestamp
        );
    }
    
    function getTrade(string memory _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }
}