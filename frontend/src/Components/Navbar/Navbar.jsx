import React, { useContext, useEffect, useState } from 'react';
import './Navbar.css';
import logo from '../Assets/logo.png';
import cart_icon from '../Assets/cart_icon.png';
import { Link, NavLink } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext';
import nav_dropdown from '../Assets/nav_dropdown.png';
import getImageSrc from '../../utils/getImageSrc';

const Navbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const { getTotalCartItems } = useContext(ShopContext);

    useEffect(() => {
        const syncLoginState = () => setIsLoggedIn(Boolean(localStorage.getItem('token')));
        syncLoginState();
        window.addEventListener('shopper-auth-change', syncLoginState);
        window.addEventListener('storage', syncLoginState);
        return () => {
            window.removeEventListener('shopper-auth-change', syncLoginState);
            window.removeEventListener('storage', syncLoginState);
        };
    }, []);

    const closeMenu = () => setMenuOpen(false);
    const logOut = () => {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        closeMenu();
    };

    return (
        <header className="navbar">
            <Link className="nav-logo" to="/" onClick={closeMenu} aria-label="Shopper home">
                <img src={getImageSrc(logo)} alt="" />
                <span>SHOPPER</span>
            </Link>
            <button
                type="button"
                className={`nav-dropdown${menuOpen ? ' open' : ''}`}
                onClick={() => setMenuOpen((isOpen) => !isOpen)}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                aria-controls="primary-navigation"
            >
                <img src={getImageSrc(nav_dropdown)} alt="" />
            </button>
            <nav aria-label="Main navigation">
                <ul id="primary-navigation" className={`nav-menu${menuOpen ? ' nav-menu-visible' : ''}`}>
                    <li><NavLink to="/" end onClick={closeMenu}>Shop</NavLink></li>
                    <li><NavLink to="/mens" onClick={closeMenu}>Men</NavLink></li>
                    <li><NavLink to="/womens" onClick={closeMenu}>Women</NavLink></li>
                    <li><NavLink to="/kids" onClick={closeMenu}>Kids</NavLink></li>
                    <li><NavLink to="/track" onClick={closeMenu}>Track order</NavLink></li>
                </ul>
            </nav>
            <div className="nav-login-cart">
                {isLoggedIn ? (
                    <button type="button" onClick={logOut} className="nav-login nav-logout">
                        Log out
                    </button>
                ) : (
                    <Link to="/login" onClick={closeMenu} className="nav-login">Log in</Link>
                )}
                <Link to="/cart" onClick={closeMenu} className="nav-cart" aria-label={`Cart, ${getTotalCartItems()} items`}>
                    <img src={getImageSrc(cart_icon)} alt="" />
                    <span className="nav-cart-count">{getTotalCartItems()}</span>
                </Link>
            </div>
        </header>
    );
};

export default Navbar