import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types';
import './ListProduct.css'
import cross_icon from '../../assets/cross_icon.png'
import { adminRequest, API_URL } from '../../api'

const ListProduct = ({ token }) => {
    const [allProducts, setAllProducts] = useState([]);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchProducts = useCallback(async () => {
        setIsLoading(true);
        setError("");
        try {
            const response = await fetch(`${API_URL}/allproducts`);
            if (!response.ok) throw new Error("Unable to load products.");
            const products = await response.json();
            setAllProducts(products);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to load products.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const removeProduct = async (id) => {
        if (!window.confirm("Remove this product?")) return;
        try {
            await adminRequest("/removeproduct", token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            setAllProducts((products) => products.filter((product) => product.id !== id));
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to remove product.");
        }
    };


return (
    <div className="list-product">
        <h1>All Products List</h1>
        <div className="listproduct-format-main">
            <p>Product</p>
            <p>Title</p>
            <p>Old Price</p>
            <p>New Price</p>
            <p>Category</p>
            <p>Remove</p>
        </div>
        <div className="listproduct-allproducts">
            <hr />
            {isLoading && <p role="status">Loading products...</p>}
            {error && <p className="admin-form-error" role="alert">{error}</p>}
            {!isLoading && !error && allProducts.length === 0 && <p>No products have been uploaded yet.</p>}
            {allProducts.map((product) =>{
                return <div key={product.id} className="listproduct-format-main listproduct-format">
                    <img src={product.image} alt="" className='listproduct-product-icon'/>
                    <p>{product.name}</p>
                    <p>${product.old_price}</p>
                    <p>${product.new_price}</p>
                    <p>{product.category}</p>
                    <button type="button" className="listproduct-remove-button" onClick={() => removeProduct(product.id)} aria-label={`Remove ${product.name}`}>
                        <img src={cross_icon} alt="" className='listproduct-remove-icon' />
                    </button>
                </div>

            })}
        </div>
    </div>

    )
}

export default ListProduct

ListProduct.propTypes = {
    token: PropTypes.string.isRequired,
};