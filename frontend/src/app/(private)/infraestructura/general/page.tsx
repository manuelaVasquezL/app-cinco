import { Metadata } from "next";
import { PersonalModule } from "@/modules/infraestructura/personal/components/PersonalModule";

export const metadata: Metadata = {
  title: "Infraestructura General - CINCO SAS",
  description: "Administración integral de infraestructura y base de personal 360°, inducción y asignación vehicular.",
};

const InfraestructuraGeneralPage = () => {
  return <PersonalModule />;
};

export default InfraestructuraGeneralPage;
