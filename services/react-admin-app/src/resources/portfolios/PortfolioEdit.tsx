import { Edit, SimpleForm, TextInput, NumberInput, DateInput, SelectInput } from "react-admin";

export const PortfolioEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" fullWidth />
      <SelectInput
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
      />
      <NumberInput source="aum" label="AUM ($M)" />
      <DateInput source="inceptionDate" label="Inception Date" />
      <TextInput source="benchmark" />
      <NumberInput source="ytdReturn" label="YTD Return %" />
      <TextInput source="manager" />
    </SimpleForm>
  </Edit>
);
