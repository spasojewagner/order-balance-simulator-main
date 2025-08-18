import React, { ChangeEvent } from "react";

interface SliderProps {
    value: number;
    onChange: (value: number) => void;
}

const Slider: React.FC<SliderProps> = ({ value, onChange }) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        onChange(newValue);
    };

    return (
        <div className="flex flex-col flex-1 pb-8">
            <div className="flex ">
                <input type="range" className="flex-grow bg-slate-900 rounded-lg cursor-pointer" min={0} max={100} step={20} value={value} onChange={handleChange} />
            </div>
            <ul className="flex justify-between w-full px-[10px]">
                <li className="flex justify-center relative">
                    <span className="absolute">0%</span>
                </li>
                <li className="flex justify-center relative">
                    <span className="absolute">20%</span>
                </li>
                <li className="flex justify-center relative">
                    <span className="absolute">40%</span>
                </li>
                <li className="flex justify-center relative">
                    <span className="absolute">60%</span>
                </li>
                <li className="flex justify-center relative">
                    <span className="absolute">80%</span>
                </li>
                <li className="flex justify-center relative">
                    <span className="absolute">100%</span>
                </li>
            </ul>
        </div>
    );
};

export default Slider;
