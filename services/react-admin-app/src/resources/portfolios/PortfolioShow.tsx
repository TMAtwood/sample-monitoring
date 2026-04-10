import {
  Show,
  SimpleShowLayout,
  TextField,
  NumberField,
  DateField,
  ReferenceManyField,
  Datagrid,
  ReferenceField,
} from "react-admin";

export const PortfolioShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="name" />
      <TextField source="strategy" />
      <NumberField source="aum" label="AUM ($M)" options={{ useGrouping: true }} />
      <DateField source="inceptionDate" label="Inception Date" />
      <TextField source="benchmark" />
      <NumberField source="ytdReturn" label="YTD Return %" />
      <TextField source="manager" />

      <ReferenceManyField
        label="Holdings"
        reference="holdings"
        target="portfolioId"
        sort={{ field: "weight", order: "DESC" }}
      >
        <Datagrid bulkActionButtons={false}>
          <ReferenceField source="securityId" reference="securities" link="show">
            <TextField source="ticker" />
          </ReferenceField>
          <ReferenceField source="securityId" reference="securities" link={false} label="Name">
            <TextField source="name" />
          </ReferenceField>
          <NumberField source="weight" label="Weight %" />
          <NumberField source="shares" options={{ useGrouping: true }} />
          <NumberField source="marketValue" label="Market Value" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
          <NumberField source="costBasis" label="Cost Basis" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        </Datagrid>
      </ReferenceManyField>
    </SimpleShowLayout>
  </Show>
);
