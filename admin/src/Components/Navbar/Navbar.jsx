import PropTypes from 'prop-types';
import './Navbar.css';
import navlogo from '../../assets/nav-logo.svg';
import navProfile from '../../assets/nav-profile.svg';

const Navbar = ({ onLogout }) => {
  return (
    <div className="navbar">
      <img src={navlogo} alt="Logo" className="nav-logo" />
      <img src={navProfile} alt="Profile" className="nav-profile" />
      <button type="button" className="admin-logout" onClick={onLogout}>Log out</button>
    </div>
  );
};

export default Navbar;

Navbar.propTypes = {
  onLogout: PropTypes.func.isRequired,
};
