import { DetailedHTMLProps, ImgHTMLAttributes } from "react";
import { DropzoneInputProps, DropzoneRootProps } from "react-dropzone";
import { Pencil1Icon } from "@radix-ui/react-icons";

export const ImageInput = (props: {
  children?: React.ReactNode;
  image: string | null;
  className?: string;
  rootProps: DropzoneRootProps;
  inputProps: DropzoneInputProps;
  isDragActive: boolean;
  height?: string;
  imageProps?: DetailedHTMLProps<
    ImgHTMLAttributes<HTMLImageElement>,
    HTMLImageElement
  >;
}) => {
  const { rootClassName, ...rootRest } = props.rootProps;

  return (
    <div
      className={`relative border p-4 flex flex-col justify-center items-center md:h-[132px] ${
        props.isDragActive ? "border-[#E2E2E2]" : "border-stone-200"
      } hover:border-stone-200 ${props.className}`}
    >
      {props.children ? (
        <div className="relative w-full">
          <div className="absolute bg-white w-8 h-8 rounded-full ml-auto flex justify-center items-center top-0 right-0">
            <Pencil1Icon className="h-4 w-4 text-black" />
          </div>
          {props.children}
        </div>
      ) : (
        <div>
          <p> Select image to upload</p>
          <p className=" opacity-80 font-normal">.png, .jpeg, .jpg</p>
        </div>
      )}

      <div className="absolute top-0 left-0 h-full w-full">
        <button
          type="button"
          className={`${rootClassName} padding-0 h-full w-full ${
            props.isDragActive ? "bg-stone-400" : "bg-transparent"
          } ${
            props.isDragActive ? "opacity-20" : "opacity-0"
          } hover:bg-[rgba(255,255,255,0.4)] hover:opacity-40`}
          {...rootRest}
        >
          <input
            className="bg-transparent outline-none"
            {...props.inputProps}
          />
        </button>
      </div>
    </div>
  );
};
