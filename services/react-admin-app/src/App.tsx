import { Admin, Resource } from "react-admin";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import PieChartIcon from "@mui/icons-material/PieChart";

import { authProvider } from "./authProvider";
import { dataProvider } from "./dataProvider";
import { theme } from "./theme";
import { Layout } from "./layout/Layout";
import { LoginPage } from "./layout/LoginPage";
import { Dashboard } from "./dashboard/Dashboard";

import {
  SecurityList,
  SecurityShow,
  SecurityEdit,
  SecurityCreate,
} from "./resources/securities";
import {
  PortfolioList,
  PortfolioShow,
  PortfolioEdit,
  PortfolioCreate,
} from "./resources/portfolios";
import {
  HoldingList,
  HoldingShow,
  HoldingEdit,
  HoldingCreate,
} from "./resources/holdings";

const App = () => (
  <Admin
    dashboard={Dashboard}
    authProvider={authProvider}
    dataProvider={dataProvider}
    theme={theme}
    layout={Layout}
    loginPage={LoginPage}
  >
    <Resource
      name="securities"
      list={SecurityList}
      show={SecurityShow}
      edit={SecurityEdit}
      create={SecurityCreate}
      icon={ShowChartIcon}
      options={{ label: "Securities" }}
    />
    <Resource
      name="portfolios"
      list={PortfolioList}
      show={PortfolioShow}
      edit={PortfolioEdit}
      create={PortfolioCreate}
      icon={AccountBalanceIcon}
      options={{ label: "Portfolios" }}
    />
    <Resource
      name="holdings"
      list={HoldingList}
      show={HoldingShow}
      edit={HoldingEdit}
      create={HoldingCreate}
      icon={PieChartIcon}
      options={{ label: "Holdings" }}
    />
  </Admin>
);

export default App;
