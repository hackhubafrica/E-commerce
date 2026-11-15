import PropTypes from 'prop-types';
import { useState } from 'react';
import './Admin.css';
import Sidebar from '../../Components/Sidebar/Sidebar'
import { Navigate, Routes,Route } from 'react-router-dom';
import AddProduct from '../../Components/AddProduct/AddProduct';
import ListProduct from '../../Components/ListProduct/ListProduct';
import PaidOrders from '../../Components/PaidOrders/PaidOrders';

const Admin = ({ token }) => {
  const [editingProduct, setEditingProduct] = useState(null);

  return (
    <div className="admin">
      <Sidebar/>
      <Routes>  
        <Route path='/' element={<Navigate to='/addproduct' replace />} />
        <Route path='/addproduct' element={<AddProduct token={token} editingProduct={editingProduct} onEditComplete={() => setEditingProduct(null)} />}/>
        <Route path='/listproduct' element={<ListProduct token={token} onEdit={(product) => setEditingProduct(product)} />}/>
        <Route path='/paidorders' element={<PaidOrders token={token} />}/>
      </Routes>
    </div>
  )
}

export default Admin;

Admin.propTypes = {
  token: PropTypes.string.isRequired,
};
