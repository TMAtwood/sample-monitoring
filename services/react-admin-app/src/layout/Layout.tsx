import { Layout as RaLayout, type LayoutProps } from "react-admin";
import { AppBar } from "./AppBar";

export const Layout = (props: LayoutProps) => (
  <RaLayout {...props} appBar={AppBar} />
);
