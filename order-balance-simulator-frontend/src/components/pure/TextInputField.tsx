import React, { ChangeEvent } from "react";

interface TextInputFieldProps {
    prefix: string;
    suffix: string;
    value?: string | number;
    type: string;
    placeholder?: string;
    onChange: (value: string | number) => void;
}

const TextInputField: React.FC<TextInputFieldProps> = ({ value, type, onChange, prefix, suffix, placeholder }) => {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className="flex items-center px-4 py-2 my-2 rounded-full border border-slate-700 group bg-slate-700 focus-within:border-slate-500">
            <label className="mr-2">{prefix}</label>
            <input type={type} placeholder={placeholder} className="text-right flex-1 appearance-none min-w-0 outline-none bg-slate-700" onChange={handleChange} value={value ?? ""} min={0} />
            <span className="text-left ml-2 w-10">{suffix}</span>
        </div>
    );
};

export default TextInputField;
