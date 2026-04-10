import {
  Edit,
  SimpleForm,
  NumberInput,
  ReferenceInput,
  AutocompleteInput,
} from "react-admin";

export const HoldingEdit = () => (
  <Edit>
    <SimpleForm>
      <ReferenceInput source="portfolioId" reference="portfolios">
        <AutocompleteInput optionText="name" />
      </ReferenceInput>
      <ReferenceInput source="securityId" reference="securities">
        <AutocompleteInput optionText={(record: { ticker: string; name: string }) => `${record.ticker} — ${record.name}`} />
      </ReferenceInput>
      <NumberInput source="weight" label="Weight %" />
      <NumberInput source="shares" />
      <NumberInput source="marketValue" label="Market Value" />
      <NumberInput source="costBasis" label="Cost Basis" />
    </SimpleForm>
  </Edit>
);
