import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import './AddProduct.css'
import upload_area from '../../assets/upload_area.svg'
import { adminRequest } from '../../api';

const emptyProduct = {
    name: "",
    category: "women",
    new_price: "",
    old_price: "",
};

const AddProduct = ({ token }) => {
    const [image, setImage] = useState(null);
    const [productDetails, setProductDetails] = useState(emptyProduct);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const formRef = useRef(null);

    const changeHandler = (event) => {
        setProductDetails((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const addProduct = async (event) => {
        event.preventDefault();
        if (!image) {
            setError("Choose a product image.");
            return;
        }
        setIsSubmitting(true);
        setError("");
        setMessage("");
        try {
            const formData = new FormData();
            formData.append("product", image);
            const uploadData = await adminRequest("/upload", token, { method: "POST", body: formData });
            await adminRequest("/addproduct", token, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...productDetails, image: uploadData.image_url }),
            });
            setProductDetails(emptyProduct);
            setImage(null);
            formRef.current?.reset();
            setMessage("Product saved. It will appear in the storefront when the catalog refreshes.");
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : "Unable to add this product.");
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <form className="add-product" onSubmit={addProduct} ref={formRef}>
            <div className="addproduct-itemfield">
                <label htmlFor="product-name">Product title</label>
                <input id="product-name" value={productDetails.name} onChange={changeHandler} type="text" name="name" maxLength={160} placeholder="Type here" required />
            </div>

            <div className="add-product-price">
                <div className="addproduct-itemfield">
                    <label htmlFor="old-price">Original price</label>
                    <input id="old-price" value={productDetails.old_price} onChange={changeHandler} type="number" name="old_price" min="0.01" step="0.01" placeholder="Type here" required />
                </div>
                <div className="addproduct-itemfield">
                    <label htmlFor="new-price">Sale price</label>
                    <input id="new-price" value={productDetails.new_price} onChange={changeHandler} type="number" name="new_price" min="0.01" step="0.01" placeholder="Type here" required />
                </div>
            </div>
            <div className="addproduct-itemfield">
                    <label htmlFor="product-category">Product category</label>
                    <select id="product-category" value={productDetails.category} onChange={changeHandler} name="category" className="add-product-selector">
                        <option value="women">Women</option>
                        <option value="men">Men</option>
                        <option value="kid">Kids</option>
                    </select>
            </div>

            <div className="addproduct-itemfield">
                <label htmlFor="file-input">Product image
                    <img src={image ? URL.createObjectURL(image) : upload_area} className="addproduct-thumbnail-img" alt={image ? image.name : "Choose an image"} />
                </label>
                <input onChange={(event) => setImage(event.target.files?.[0] || null)} type="file" name="image" id="file-input" accept="image/jpeg,image/png,image/webp,image/gif" required />
            </div>
            {error && <p className="admin-form-error" role="alert">{error}</p>}
            {message && <p className="admin-form-success" role="status">{message}</p>}
            <button type="submit" className="addproduct-btn" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Add product"}</button>
        </form>
    )
}

export default AddProduct;

AddProduct.propTypes = {
    token: PropTypes.string.isRequired,
};