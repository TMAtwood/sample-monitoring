import {
  Show,
  SimpleShowLayout,
  NumberField,
  ReferenceField,
  TextField,
} from "react-admin";

export const HoldingShow = () => (
  <Show>
    <SimpleShowLayout>
      <ReferenceField source="portfolioId" reference="portfolios" link="show">
        <TextField source="name" />
      </ReferenceField>
      <ReferenceField source="securityId" reference="securities" link="show">
        <TextField source="name" />
      </ReferenceField>
      <NumberField source="weight" label="Weight %" />
      <NumberField source="shares" options={{ useGrouping: true }} />
      <NumberField source="marketValue" label="Market Value" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
      <NumberField source="costBasis" label="Cost Basis" options={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
    </SimpleShowLayout>
  </Show>
);
