import React from "react";
import { Input } from "../ui/input";

interface AfterLabelInput extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string | number;
  onChange: (event: any) => void; // Renamed to avoid conflict with existing `onChange`
  label: string;
}

export const AfterLabelInput: React.FC<AfterLabelInput> = ({
  value,
  onChange,
  label,
  ...rest
}) => {
  return (
    <div className="flex border-[1px]border-input file:border-0">
      <Input
        {...rest}
        value={value}
        onChange={onChange}
        className="text-white rounded-r-none w-12 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="bg-[#FFFFFF40] text-white text-sm px-3 select-none border-input border-[1px] border-l-0 flex items-center">
        {label}
      </span>
    </div>
  );
};
