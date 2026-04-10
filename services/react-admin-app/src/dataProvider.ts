import fakeRestDataProvider from "ra-data-fakerest";
import data from "./data";

export const dataProvider = fakeRestDataProvider(data, true);
