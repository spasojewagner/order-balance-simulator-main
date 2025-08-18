import React from "react";

interface ButtonProps {
    label: String;
    disabled: boolean;
    onClick: Function;
    customStyle?: String;
}

const Button: React.FC<ButtonProps> = ({ label, disabled, onClick, customStyle }) => {
    return (
        <div className="m-2 w-48 lg:w-72 xl:w-96 flex">
            <button className={` text-center py-2 ${customStyle ?? "bg-slate-700 hover:bg-slate-600"} px-4 rounded-full flex-1  ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`} onClick={(e) => onClick(e)} disabled={disabled}>
                <span className="text-sm">{label}</span>
            </button>
        </div>
    );
};

export default Button;
