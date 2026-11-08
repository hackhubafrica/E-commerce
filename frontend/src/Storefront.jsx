import ShopContextProvider from "./Context/ShopContext";
import App from "./App";

const Storefront = ({ location }) => (
  <ShopContextProvider>
    <App location={location} />
  </ShopContextProvider>
);

export default Storefront;
