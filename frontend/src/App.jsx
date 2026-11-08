import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import Navbar from "./Components/Navbar/Navbar";
import Shop from './Pages/Shop';
import ShopCategory from './Pages/ShopCategory';
import Product from './Pages/Product';
import Cart from './Pages/Cart';
import LoginSignup from './Pages/LoginSignup';
import OrderTracking from './Pages/OrderTracking';
import JotformCheckout from './Components/Checkout/JotformCheckout';
import Footer from './Components/Footer/Footer';
import men_banner from './Components/Assets/banner_mens.png'
import women_banner from './Components/Assets/banner_women.png'
import kid_banner from './Components/Assets/banner_kids.png'
import './App.css'

function App({ location = '/' }) {
  const routes = (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<Shop />} />
        <Route path="/mens" element={<ShopCategory banner={men_banner} category="men" />} />
        <Route path="/womens" element={<ShopCategory banner={women_banner} category="women" />} />
        <Route path="/kids" element={<ShopCategory banner={kid_banner} category="kid" />} />
        <Route path="/product/:productId" element={<Product />} />
        <Route path="/product" element={<Product />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<JotformCheckout />} />
        <Route path="/login" element={<LoginSignup />} />
        <Route path="/track" element={<OrderTracking />} />
      </Routes>
      <Footer />
    </div>
  );

  return typeof window === 'undefined'
    ? <StaticRouter location={location}>{routes}</StaticRouter>
    : <BrowserRouter>{routes}</BrowserRouter>;
}

export default App;

