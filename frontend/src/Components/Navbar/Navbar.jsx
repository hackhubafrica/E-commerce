import React, {useContext, useRef, useState} from 'react';
import './Navbar.css';
import logo  from '../Assets/logo.png';
import cart_icon from  '../Assets/cart_icon.png';
import { Link , useNavigate } from 'react-router-dom';
import { ShopContext } from '../../Context/ShopContext'
import nav_dropdown  from '../Assets/nav_dropdown.png'

const Navbar = () =>{
        const [menu,setMenu] = useState("shop");
	    const {getTotalCartItems } = useContext(ShopContext);
        const menuRef = useRef();
        const navigate = useNavigate();


        // Check if user is logged in by checking local storage
        const isLoggedIn = !!localStorage.getItem('token'); 

        const dropdown_toggle = (e) =>{
        menuRef.currentList.toggle('nav-menu-visible')
        e.target.classList.toggle('open')
        }

        const handleLogout = () => {
            localStorage.removeItem('token'); // Remove token from local storage
            navigate('/'); // Redirect to the home page or any other page
            window.location.reload(); // Optional: reload the page to refresh the state
        };
        return(
            <div className='navbar'>
                <div className="nav-logo">
                    <img src={logo} alt=""/>
                    <p>SHOPPER</p>
                </div>
                <img onClick={dropdown_toggle} className='nav-dropdown' src={nav_dropdown} alt="" />
                <ul ref = {menuRef} className="nav-menu">
                    <li onClick={()=>{setMenu("shop")}}><Link to='/' >Shop </Link> {menu === "shop"?<h/>:<></>}</li>
                    <li onClick={()=>{setMenu("mens")}}><Link to='/mens'> Men </Link> {menu === "mens"?<h/>:<></>}</li>
                    <li onClick={()=>{setMenu("women")}}><Link to ='womens'>Women </Link> {menu === "mens"?<h/>:<></>}</li>
                    <li onClick={()=>{setMenu("kids")}}><Link to='kids' > Kids </Link>{menu === "kids"?<h/>:<></>}</li>
                </ul>
                <div className="nav-login-cart">
                    <Link to='./login'><button>login</button></Link>
                    <Link to='./cart'><img src={cart_icon} alt=""/></Link>
                    <div className="nav-cart-count">{getTotalCartItems()}</div>
                </div>
            </div>
    );
};

export default Navbar