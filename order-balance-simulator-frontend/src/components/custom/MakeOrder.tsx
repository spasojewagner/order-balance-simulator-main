// src/components/MakeOrder.tsx - ENHANCED WITH SIGNATURE FLOW

import React, { useState, useEffect, useCallback } from "react";
import { ISymbol } from "../../@types";
import TextInputField from "../pure/TextInputField";
import Slider from "../pure/StepSlider";
import Button from "../pure/Button";
import { walletService } from "../../services/walletService";
import { useAppSelector } from "../../store";

export interface MakeOrderProps {
    symbol: ISymbol;
    defaultPrice: number;
    isMarket: boolean;
    buttonLabel: string;
    customStyle?: string;
    balance1: number;
    balance2: number;
    balanceCheck: (price: number, percent: number) => number;
    checkValidity: (price: number, quantity: number) => boolean;
    onSubmitted: (price: number, quantity: number, signature?: string) => void;
}

const MakeOrder: React.FC<MakeOrderProps> = ({ 
    symbol, 
    defaultPrice, 
    isMarket, 
    buttonLabel, 
    checkValidity, 
    onSubmitted, 
    balanceCheck, 
    customStyle,
    balance1,
    balance2
}) => {
    const [price, setPrice] = useState<number>(0);
    const [quantity, setQuantity] = useState<number>(0);
    const [total, setTotal] = useState<number>(0);
    const [sliderValue, setSliderValue] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [signatureError, setSignatureError] = useState<string>('');

    // Get wallet state from Redux
    const { walletConnected, walletAddress } = useAppSelector((state) => state.app);
  

    const isBuyOrder = buttonLabel.toLowerCase().includes('buy');

    // Update price when defaultPrice changes, with fallback
    useEffect(() => {
        if (defaultPrice && defaultPrice > 0) {
            setPrice(defaultPrice);
        } else if (isMarket) {
            setPrice(1); // Fallback for market orders
        }
    }, [defaultPrice, isMarket]);

    // Memoized slider change handler to prevent unnecessary re-renders
    const handleSliderChange = useCallback((value: number) => {
        setSliderValue(value);
        
        if (isMarket && price > 0) {
            if (isBuyOrder) {
                // For market buy, total is percentage of balance2
                const calculatedTotal = (balance2 * value) / 100;
                setTotal(Number(calculatedTotal.toFixed(8)));
                
                if (price > 0) {
                    setQuantity(Number((calculatedTotal / price).toFixed(8)));
                } else {
                    setQuantity(0);
                }
            } else {
                // For sell market orders
                const calculatedQuantity = balanceCheck(price, value);
                setQuantity(Number(calculatedQuantity.toFixed(8)));
                setTotal(Number((calculatedQuantity * price).toFixed(8)));
            }
        } else if (!isMarket && price > 0) {
            // Limit orders
            const calculatedQuantity = balanceCheck(price, value);
            setQuantity(Number(calculatedQuantity.toFixed(8)));
            setTotal(Number((calculatedQuantity * price).toFixed(8)));
        } else {
            setQuantity(0);
            setTotal(0);
        }
    }, [price, isMarket, isBuyOrder, balance2, balanceCheck]);

    // Handle price change (limit orders only)
    const handlePriceChange = useCallback((value: string | number) => {
        const numPrice = Number(value);
        setPrice(numPrice);
        
        // Recalculate quantity/total if slider has value
        if (sliderValue > 0 && numPrice > 0) {
            if (isMarket && isBuyOrder) {
                const calculatedTotal = (balance2 * sliderValue) / 100;
                setTotal(Number(calculatedTotal.toFixed(8)));
                setQuantity(Number((calculatedTotal / numPrice).toFixed(8)));
            } else {
                const calculatedQuantity = balanceCheck(numPrice, sliderValue);
                setQuantity(Number(calculatedQuantity.toFixed(8)));
                setTotal(Number((calculatedQuantity * numPrice).toFixed(8)));
            }
        } else if (quantity > 0) {
            setTotal(Number((numPrice * quantity).toFixed(8)));
        }
    }, [sliderValue, isMarket, isBuyOrder, balance2, balanceCheck, quantity]);

    // Handle quantity change
    const handleQuantityChange = useCallback((value: string | number) => {
        const numQuantity = Number(value);
        setQuantity(numQuantity);
        
        if (price > 0) {
            setTotal(Number((numQuantity * price).toFixed(8)));
        }
        
        // Reset slider when manually changing quantity
        if (numQuantity === 0) {
            setSliderValue(0);
            setTotal(0);
        }
    }, [price]);

    // Handle total change (market buy orders only)
    const handleTotalChange = useCallback((value: string | number) => {
        const numTotal = Number(value);
        setTotal(numTotal);
        
        if (price > 0) {
            setQuantity(Number((numTotal / price).toFixed(8)));
        }
        
        // Reset slider when manually changing total
        if (numTotal === 0) {
            setSliderValue(0);
            setQuantity(0);
        }
    }, [price]);

    // Enhanced form submission with signature
    const handleSubmit = useCallback(async () => {
        if (!checkValidity(price, quantity)) {
            console.warn('⚠️ Order validation failed');
            return;
        }

        if (!walletConnected || !walletAddress) {
            setSignatureError('Please connect your wallet first');
            return;
        }

        try {
            setIsSubmitting(true);
            setSignatureError('');
            
            console.log('📝 Creating order with signature...');

            // Create order data for signing
            const orderData = {
                orderId: walletService.generateOrderId(),
                userAddress: walletAddress,
                tokenA: symbol.tokenAAddress || walletService.getTestTokenAddress('USDC', walletService.getNetworkId() || 11155111),
                tokenB: symbol.tokenBAddress || walletService.getTestTokenAddress('USDT', walletService.getNetworkId() || 11155111),
                amountA: quantity.toString(),
                amountB: (quantity * price).toString(),
                price: price.toString(),
                orderType: isBuyOrder ? 'buy' as const : 'sell' as const,
                timestamp: Date.now(),
                nonce: walletService.generateNonce()
            };

            console.log('🔐 Requesting signature for order:', orderData);

            // Request signature from wallet
            const signature = await walletService.signOrderData(orderData);
            
            console.log('✅ Order signed successfully');

            // Additional blockchain balance validation before submission
            const tokenToCheck = isBuyOrder ? orderData.tokenB : orderData.tokenA;
            const amountToCheck = isBuyOrder ? (quantity * price).toString() : quantity.toString();
            
            const balanceValidation = await walletService.validateBalance(tokenToCheck, amountToCheck, walletAddress);
            
            if (!balanceValidation.valid) {
                throw new Error(balanceValidation.error || 'Insufficient balance');
            }

            // Call parent's onSubmitted with signature
            await onSubmitted(price, quantity, signature);
            
            // Reset form after successful submission
            setQuantity(0);
            setTotal(0);
            setSliderValue(0);
            setSignatureError('');
            
            console.log('✅ Order submitted successfully');

        } catch (error: any) {
            console.error('❌ Order submission failed:', error);
            const errorMessage = walletService.handleError(error);
            setSignatureError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [checkValidity, price, quantity, walletConnected, walletAddress, symbol, isBuyOrder, onSubmitted]);

    // Memoized validation check to prevent recalculation on every render
    const isValid = React.useMemo(() => {
        return checkValidity(price, quantity);
    }, [checkValidity, price, quantity]);

    const isFormReady = React.useMemo(() => {
        if (!walletConnected) return false;
        return price > 0 && (isMarket ? 
            (isBuyOrder ? total > 0 && isValid : quantity > 0 && isValid) :
            isValid);
    }, [price, isMarket, isBuyOrder, total, quantity, isValid, walletConnected]);

    const getSubmitButtonText = (): string => {
        if (isSubmitting) return 'Signing & Submitting...';
        if (!walletConnected) return 'Connect Wallet First';
        return buttonLabel;
    };

    const getSubmitButtonClass = (): string => {
        let baseClass = customStyle || 'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200';
        
        if (isSubmitting) {
            return `${baseClass} bg-yellow-600 text-white cursor-not-allowed opacity-75`;
        }
        
        if (!walletConnected) {
            return `${baseClass} bg-gray-600 text-gray-300 cursor-not-allowed`;
        }
        
        if (!isFormReady) {
            return `${baseClass} bg-gray-600 text-gray-400 cursor-not-allowed`;
        }

        return baseClass;
    };

    return (
        <div className="space-y-3">
            {/* Wallet Connection Status */}
            {!walletConnected && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 p-3 rounded-lg">
                    <div className="text-sm text-yellow-400 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Connect your wallet to create orders with blockchain signatures</span>
                    </div>
                </div>
            )}

            {/* Price Field */}
            {isMarket ? (
                <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg">
                    <span className="text-sm text-gray-400">Price</span>
                    <span className="text-sm text-gray-300 font-medium">
                        {price > 0 ? `${price.toFixed(6)} ${symbol.coinB}` : "Loading..."}
                    </span>
                </div>
            ) : (
                <TextInputField
                    type="number"
                    prefix="Price"
                    suffix={symbol.coinB}
                    value={price}
                    placeholder="0.000000"
                    onChange={handlePriceChange}
                />
            )}

            {/* For Market Buy Orders: Show Total field first, then Amount */}
            {isMarket && isBuyOrder ? (
                <>
                    <TextInputField
                        type="number"
                        prefix="Total"
                        suffix={symbol.coinB}
                        value={total}
                        placeholder="0.000000"
                        onChange={handleTotalChange}
                    />
                    <TextInputField
                        type="number"
                        prefix="Amount"
                        suffix={symbol.coinA}
                        value={quantity}
                        placeholder="0.000000"
                        onChange={() => {}} // Read-only for market buy
                        disabled={true}
                    />
                </>
            ) : (
                /* For Market Sell Orders and Limit Orders: Show Amount field */
                <>
                    <TextInputField
                        type="number"
                        prefix={isMarket ? "Amount" : "Quantity"}
                        suffix={symbol.coinA}
                        value={quantity}
                        placeholder="0.000000"
                        onChange={handleQuantityChange}
                    />
                    {/* Show Total for Market Sell (read-only) */}
                    {isMarket && !isBuyOrder && (
                        <TextInputField
                            type="number"
                            prefix="Total"
                            suffix={symbol.coinB}
                            value={total}
                            placeholder="0.000000"
                            onChange={() => {}} // Read-only for market sell
                            disabled={true}
                        />
                    )}
                </>
            )}

            {/* Balance Slider */}
            <div className="mt-4 mb-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Use Balance</span>
                    <span>{sliderValue}%</span>
                </div>
                <div className="pb-4">
                    <Slider
                        value={sliderValue}
                        onChange={handleSliderChange}
                    />
                </div>
            </div>

            {/* Order Summary */}
            {((isMarket && isBuyOrder && total > 0) || 
              (isMarket && !isBuyOrder && quantity > 0) || 
              (!isMarket && quantity > 0 && price > 0)) && (
                <div className="bg-slate-800/50 p-3 rounded-lg">
                    <div className="text-sm text-gray-300 space-y-2">
                        {isMarket ? (
                            <>
                                <div className="flex justify-between">
                                    <span>{isBuyOrder ? 'You will pay:' : 'You will receive:'}:</span>
                                    <span className="font-medium">
                                        {isBuyOrder ? 
                                            `${total.toFixed(6)} ${symbol.coinB}` : 
                                            `${total.toFixed(6)} ${symbol.coinB}`
                                        }
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{isBuyOrder ? 'You will receive:' : 'You will sell:'}:</span>
                                    <span className="font-medium">
                                        {quantity.toFixed(8)} {symbol.coinA}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex justify-between">
                                    <span>Total:</span>
                                    <span className="font-medium">
                                        {(price * quantity).toFixed(6)} {symbol.coinB}
                                    </span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between">
                            <span>Type:</span>
                            <span className="font-medium">
                                {isMarket ? 'Market Order' : 'Limit Order'}
                            </span>
                        </div>
                        {walletConnected && (
                            <div className="flex justify-between">
                                <span>Requires:</span>
                                <span className="font-medium text-blue-400">
                                    MetaMask Signature
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Signature Error Display */}
            {signatureError && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-600/30 p-2 rounded">
                    <div className="flex items-center gap-2">
                        <span>❌</span>
                        <span>{signatureError}</span>
                    </div>
                </div>
            )}

            {/* Balance Validation Message */}
            {walletConnected && 
             ((isMarket && isBuyOrder && total > 0) || 
              (isMarket && !isBuyOrder && quantity > 0) || 
              (!isMarket && quantity > 0 && price > 0)) && 
             !isValid && (
                <div className="text-sm text-red-400 bg-red-900/20 border border-red-600/30 p-2 rounded">
                    <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                            {isBuyOrder 
                                ? `Insufficient ${symbol.coinB} balance (need: ${(price * quantity).toFixed(2)}, have: ${balance2})` 
                                : `Insufficient ${symbol.coinA} balance (need: ${quantity.toFixed(8)}, have: ${balance1})`
                            }
                        </span>
                    </div>
                </div>
            )}

            {/* Blockchain Balance Check Info */}
            {walletConnected && isFormReady && (
                <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-600/30 p-2 rounded">
                    <div className="flex items-center gap-2">
                        <span>ℹ️</span>
                        <span>Order will be validated against your on-chain balance before submission</span>
                    </div>
                </div>
            )}

            {/* Submit Button */}
            <Button
                disabled={!isFormReady || isSubmitting}
                label={getSubmitButtonText()}
                onClick={handleSubmit}
                customStyle={getSubmitButtonClass()}
            />

            {/* Signing Process Indicator */}
            {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-sm text-yellow-400">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Please sign the transaction in MetaMask...</span>
                </div>
            )}

            {/* Wallet Connection Guide */}
            {!walletConnected && (
                <div className="text-xs text-gray-500 text-center">
                    Orders created without wallet connection will not have blockchain signatures and may be rejected by the system.
                </div>
            )}
        </div>
    );
};

export default MakeOrder;