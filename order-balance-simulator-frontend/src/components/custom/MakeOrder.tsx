import React, { useState, useEffect, useCallback } from "react";
import { ISymbol } from "../../@types";
import TextInputField from "../pure/TextInputField";
import Slider from "../pure/StepSlider";
import Button from "../pure/Button";

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
    onSubmitted: (price: number, quantity: number) => void;
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

    // Handle form submission
    const handleSubmit = useCallback(() => {
        if (checkValidity(price, quantity)) {
            onSubmitted(price, quantity);
            
            // Reset form after successful submission
            setQuantity(0);
            setTotal(0);
            setSliderValue(0);
        }
    }, [checkValidity, price, quantity, onSubmitted]);

    // Memoized validation check to prevent recalculation on every render
    const isValid = React.useMemo(() => {
        return checkValidity(price, quantity);
    }, [checkValidity, price, quantity]);

    const isFormReady = React.useMemo(() => {
        return price > 0 && (isMarket ? 
            (isBuyOrder ? total > 0 && isValid : quantity > 0 && isValid) :
            isValid);
    }, [price, isMarket, isBuyOrder, total, quantity, isValid]);

    return (
        <div className="space-y-3">
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
                    <div className="text-sm text-gray-300">
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
                                <div className="flex justify-between mt-1">
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
                        <div className="flex justify-between mt-1">
                            <span>Type:</span>
                            <span className="font-medium">
                                {isMarket ? 'Market Order' : 'Limit Order'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Message */}
            {((isMarket && isBuyOrder && total > 0) || 
              (isMarket && !isBuyOrder && quantity > 0) || 
              (!isMarket && quantity > 0 && price > 0)) && 
             !isValid && (
                <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
                    {isBuyOrder 
                        ? `Insufficient ${symbol.coinB} balance (need: ${(price * quantity).toFixed(2)}, have: ${balance2})` 
                        : `Insufficient ${symbol.coinA} balance (need: ${quantity.toFixed(8)}, have: ${balance1})`
                    }
                </div>
            )}

            {/* Submit Button */}
            <Button
                disabled={!isFormReady}
                label={buttonLabel}
                onClick={handleSubmit}
                customStyle={customStyle}
            />
        </div>
    );
};

export default MakeOrder;