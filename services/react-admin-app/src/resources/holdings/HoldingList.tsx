import {
  List,
  Datagrid,
  NumberField,
  ReferenceField,
  ReferenceInput,
  TextField,
  FunctionField,
} from "react-admin";

const holdingFilters = [
  <ReferenceInput key="portfolioId" source="portfolioId" reference="portfolios" />,
];

export const HoldingList = () => (
  <List filters={holdingFilters} sort={{ field: "marketValue", order: "DESC" }} perPage={25}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <ReferenceField source="portfolioId" reference="portfolios" link="show">
        <TextField source="name" />
      </ReferenceField>
      <ReferenceField source="securityId" reference="securities" link="show" label="Ticker">
        <TextField source="ticker" />
      </ReferenceField>
      <ReferenceField source="securityId" reference="securities" link={false} label="Security">
        <TextField source="name" />
      </ReferenceField>
      <NumberField source="weight" label="Weight %" />
      <NumberField source="shares" options={{ useGrouping: true }} />
      <NumberField source="marketValue" label="Market Value" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
      <NumberField source="costBasis" label="Cost Basis" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
      <FunctionField
        label="Gain/Loss"
        render={(record: { marketValue: number; costBasis: number }) => {
          const gain = record.marketValue - record.costBasis;
          const pct = ((gain / record.costBasis) * 100).toFixed(1);
          return (
            <span style={{ color: gain >= 0 ? "#389865" : "#d32f2f", fontWeight: 600 }}>
              {gain >= 0 ? "+" : ""}${(gain / 1000).toFixed(0)}K ({pct}%)
            </span>
          );
        }}
      />
    </Datagrid>
  </List>
);
