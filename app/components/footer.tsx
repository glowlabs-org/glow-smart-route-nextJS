import Image from "next/image";

export const Footer = () => (
  <div className="p-12 py-20 pb-8 bg-secondary text-white">
    <div className="max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between space-y-8 md:space-y-0 text-white">
        <div className="flex flex-col justify-between space-y4">
          <div>
            <Image src="/logo.png" alt="Glow Logo" width={75} height={75} />
            <p className="mt-4 font-light text-xl">
              A community working together to build a more <br /> sustainable
              energy grid.
            </p>
          </div>
          <a className="mt-4 font-light" href="mailto:hello@glowlabs.org">
            hello@glowlabs.org
          </a>
        </div>
        <div className="flex space-x-8">
          <div className="text-lg flex flex-col space-y-4">
            <span className="text-4xl font-mono font-medium">Company</span>
            <a
              href="https://glowlabs.org/#about"
              target="_blank"
              className="hover:underline opacity-90"
            >
              About
            </a>
            <a
              href="https://glowlabs.org/#fundamentals"
              target="_blank"
              className="hover:underline  opacity-90"
            >
              Fundamentals
            </a>
            <a
              href="https://glowlabs.org/press"
              target="_blank"
              className="hover:underline  opacity-90"
            >
              Press
            </a>
            <a
              href="https://glowlabs.org/careers"
              target="_blank"
              className="hover:underline  opacity-90"
            >
              Careers
            </a>
          </div>
          <div className="text-lg flex flex-col space-y-4">
            <span className="text-4xl font-mono font-medium">Legal</span>
            <a
              href="https://glowgreen.org/privacy-policy"
              target="_blank"
              className="hover:underline  opacity-90"
            >
              Privacy policy
            </a>
            <a
              href="https://glowgreen.org/terms-and-conditions"
              target="_blank"
              className="hover:underline  opacity-90"
            >
              Terms of service
            </a>
          </div>
        </div>
      </div>
      <div className="text-center text-sm mt-4 text-white">
        ©2023 GlowGreen. All rights reserved.
      </div>
    </div>
  </div>
);
