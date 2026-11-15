import React, { useContext, useEffect, useState } from 'react';
import './Navbar.css';
import logo from '../Assets/logo.png';
import cart_icon from '../Assets/cart_icon.png';
import { Link, NavLink } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext';
import nav_dropdown from '../Assets/nav_dropdown.png';
import nav_profile from '../Assets/nav-profile.svg';
import { API_URL } from '../../config';
import getImageSrc from '../../utils/getImageSrc';

const Navbar = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userName, setUserName] = useState('');
    const { getTotalCartItems } = useContext(ShopContext);

    useEffect(() => {
        const syncLoginState = async () => {
            const token = localStorage.getItem('token');
            setIsLoggedIn(Boolean(token));
            setUserName('');
            if (token) {
                try {
                    const response = await fetch(`${API_URL}/api/user/me`, {
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` },
                    });
                    const data = await response.json().catch(() => ({}));
                    if (data.success && data.user) {
                        setUserName(data.user.name || '');
                    }
                } catch {
                    // User is logged in but profile fetch failed; still allow logout
                }
            }
        };
        syncLoginState();
        window.addEventListener('shopper-auth-change', syncLoginState);
        window.addEventListener('storage', syncLoginState);
        return () => {
            window.removeEventListener('shopper-auth-change', syncLoginState);
            window.removeEventListener('storage', syncLoginState);
        };
    }, [API_URL]);

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
                    <li><NavLink to="/catalog" onClick={closeMenu}>Shop all</NavLink></li>
                    <li><NavLink to="/office" onClick={closeMenu}>Office & desk</NavLink></li>
                    <li><NavLink to="/mens" onClick={closeMenu}>Men</NavLink></li>
                    <li><NavLink to="/womens" onClick={closeMenu}>Women</NavLink></li>
                    <li><NavLink to="/kids" onClick={closeMenu}>Kids</NavLink></li>
                    <li><NavLink to="/track" onClick={closeMenu}>Track order</NavLink></li>
                </ul>
            </nav>
            <div className="nav-login-cart">
                {isLoggedIn && userName && (
                    <div className="nav-profile">
                        <span className="nav-profile-name">{userName}</span>
                        <Link to="/profile" className="nav-profile-link">
                            <img src={nav_profile} alt="Profile" />
                        </Link>
                    </div>
                )}
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