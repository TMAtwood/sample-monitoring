import {
  Show,
  SimpleShowLayout,
  TextField,
  NumberField,
  ReferenceManyField,
  Datagrid,
  ReferenceField,
} from "react-admin";

export const SecurityShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="ticker" />
      <TextField source="name" />
      <TextField source="sector" />
      <TextField source="exchange" />
      <NumberField source="price" options={{ style: "currency", currency: "USD" }} />
      <NumberField source="marketCap" label="Market Cap ($B)" />
      <NumberField source="peRatio" label="P/E Ratio" />
      <NumberField source="dividendYield" label="Dividend Yield %" />

      <ReferenceManyField
        label="Portfolio Holdings"
        reference="holdings"
        target="securityId"
      >
        <Datagrid bulkActionButtons={false}>
          <ReferenceField source="portfolioId" reference="portfolios" link="show">
            <TextField source="name" />
          </ReferenceField>
          <NumberField source="weight" label="Weight %" />
          <NumberField source="shares" options={{ useGrouping: true }} />
          <NumberField source="marketValue" label="Market Value" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
        </Datagrid>
      </ReferenceManyField>
    </SimpleShowLayout>
  </Show>
);
