import React from "react";
import { IOrder, OrderType } from "../../@types/order";

interface OrderBookTableProps {
    orderData: IOrder[];
    type: OrderType;
    onRowClicked: (price: number) => void;
}

const OrderBookTable: React.FC<OrderBookTableProps> = ({ orderData, type, onRowClicked }) => {
    let colorClassName = "";
    if (type === OrderType.Buy) {
        colorClassName = "text-red-400";
    } else if (type === OrderType.Sell) {
        colorClassName = "text-green-400";
    }
    return (
        <div className="bg-slate-900 border-slate-500 flex">
            <table className="border-collapse border-slate-500 flex-1">
                <thead className="block">
                    <tr>
                        <th className={`py-1 text-left text-md ${colorClassName} px-2 w-auto sm:min-w-28`}>Price</th>
                        <th className={`py-1 text-center text-md ${colorClassName} px-2 w-full sm:min-w-28`}>Amount</th>
                        <th className={`py-1 text-right text-md ${colorClassName} px-2 w-full sm:min-w-28`}>Total</th>
                    </tr>
                </thead>
                <tbody className="block h-96 overflow-y-scroll scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-slate-800">
                    {orderData.map((order: IOrder, index: number) => {
                        return (
                            <tr
                                key={index}
                                className="cursor-pointer"
                                onClick={() => {
                                    onRowClicked(order.price);
                                }}
                            >
                                <td className={`py-1 text-left text-md ${colorClassName} px-2 w-auto`}>{order.price.toFixed(2)}</td>
                                <td className="py-1 text-center text-md px-2 w-full">{order.quantity.toFixed(6)}</td>
                                <td className="py-1 text-right text-md px-2 w-full">{order.total.toFixed(2)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default OrderBookTable;
