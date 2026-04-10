import {
  List,
  Datagrid,
  TextField,
  NumberField,
  SelectInput,
  TextInput,
} from "react-admin";

const securityFilters = [
  <TextInput key="q" source="q" label="Search" alwaysOn />,
  <SelectInput
    key="sector"
    source="sector"
    choices={[
      { id: "Technology", name: "Technology" },
      { id: "Healthcare", name: "Healthcare" },
      { id: "Financials", name: "Financials" },
      { id: "Consumer Discretionary", name: "Consumer Discretionary" },
      { id: "Consumer Staples", name: "Consumer Staples" },
      { id: "Energy", name: "Energy" },
      { id: "Industrials", name: "Industrials" },
      { id: "Communications", name: "Communications" },
      { id: "Utilities", name: "Utilities" },
      { id: "Real Estate", name: "Real Estate" },
    ]}
  />,
  <SelectInput
    key="exchange"
    source="exchange"
    choices={[
      { id: "NYSE", name: "NYSE" },
      { id: "NASDAQ", name: "NASDAQ" },
    ]}
  />,
];

export const SecurityList = () => (
  <List filters={securityFilters} perPage={25} sort={{ field: "marketCap", order: "DESC" }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <TextField source="ticker" />
      <TextField source="name" />
      <TextField source="sector" />
      <TextField source="exchange" />
      <NumberField source="price" options={{ style: "currency", currency: "USD" }} />
      <NumberField source="marketCap" label="Mkt Cap ($B)" />
      <NumberField source="peRatio" label="P/E" options={{ maximumFractionDigits: 1 }} />
      <NumberField
        source="dividendYield"
        label="Div Yield %"
        options={{ style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        transform={(v: number) => v / 100}
      />
    </Datagrid>
  </List>
);
