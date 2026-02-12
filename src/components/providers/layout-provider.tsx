import React from "react";
import { NavBar } from "../layout/NavBar";

export const LayoutProvider = ({
  children,
}: Readonly<{ children: React.ReactNode }>) => {
  return (
    <div>
      <NavBar />
      {children}
    </div>
  );
};
