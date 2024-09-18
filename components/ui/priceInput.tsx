import React from "react";
import { Input } from "../ui/input";

interface PriceInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string | number;
  onChange: (event: any) => void; // Renamed to avoid conflict with existing `onChange`
}

export const PriceInput: React.FC<PriceInputProps> = ({
  value,
  onChange,
  ...rest
}) => {
  return (
    <div className="flex bg-primary border border-input file:border-0">
      <span className="text-secondary text-sm px-3 select-none border-r flex items-center">
        USD
      </span>
      <Input
        {...rest}
        value={value}
        onChange={onChange}
        className=" rounded-l-none w-32 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
};
