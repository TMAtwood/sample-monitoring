import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  SelectInput,
  TextInput,
  FunctionField,
} from "react-admin";
import { Chip } from "@mui/material";

const portfolioFilters = [
  <TextInput key="q" source="q" label="Search" alwaysOn />,
  <SelectInput
    key="strategy"
    source="strategy"
    choices={[
      { id: "Long Only", name: "Long Only" },
      { id: "Growth", name: "Growth" },
      { id: "Value", name: "Value" },
      { id: "Dividend Income", name: "Dividend Income" },
      { id: "Quant", name: "Quant" },
      { id: "Long/Short", name: "Long/Short" },
      { id: "Sector Rotation", name: "Sector Rotation" },
      { id: "Multi-Strategy", name: "Multi-Strategy" },
    ]}
  />,
];

export const PortfolioList = () => (
  <List filters={portfolioFilters} sort={{ field: "aum", order: "DESC" }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <TextField source="name" />
      <FunctionField
        label="Strategy"
        render={(record: { strategy: string }) => (
          <Chip label={record.strategy} size="small" sx={{ backgroundColor: "#6AC897", color: "#fff" }} />
        )}
      />
      <NumberField source="aum" label="AUM ($M)" options={{ useGrouping: true, maximumFractionDigits: 0 }} />
      <DateField source="inceptionDate" label="Inception" />
      <TextField source="benchmark" />
      <FunctionField
        label="YTD Return"
        render={(record: { ytdReturn: number }) => (
          <span style={{ color: record.ytdReturn >= 0 ? "#389865" : "#d32f2f", fontWeight: 600 }}>
            {record.ytdReturn >= 0 ? "+" : ""}
            {record.ytdReturn.toFixed(1)}%
          </span>
        )}
      />
      <TextField source="manager" />
    </Datagrid>
  </List>
);
