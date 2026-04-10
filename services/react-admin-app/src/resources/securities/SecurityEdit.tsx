import { Edit, SimpleForm, TextInput, NumberInput, SelectInput } from "react-admin";

export const SecurityEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="ticker" />
      <TextInput source="name" fullWidth />
      <SelectInput
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
      />
      <SelectInput
        source="exchange"
        choices={[
          { id: "NYSE", name: "NYSE" },
          { id: "NASDAQ", name: "NASDAQ" },
        ]}
      />
      <NumberInput source="price" />
      <NumberInput source="marketCap" label="Market Cap ($B)" />
      <NumberInput source="peRatio" label="P/E Ratio" />
      <NumberInput source="dividendYield" label="Dividend Yield %" />
    </SimpleForm>
  </Edit>
);
