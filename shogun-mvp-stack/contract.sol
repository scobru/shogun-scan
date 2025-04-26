// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract UserRegistry {
    mapping(address => bytes) public publicKeys;

    event UserRegistered(address indexed user, bytes pubKey);
    event UserKeyUpdated(address indexed user, bytes oldKey, bytes newKey);

    function registerFor(
        address user,
        bytes calldata pubKey,
        bytes32 hash,
        bytes calldata signature
    ) external {
        require(publicKeys[user].length == 0, "User already registered");

        address recovered = recoverSigner(
            toEthSignedMessageHash(hash),
            signature
        );
        require(recovered == user, "Invalid signature");

        publicKeys[user] = pubKey;
        emit UserRegistered(user, pubKey);
    }

    function updateKey(
        bytes calldata newPubKey,
        bytes32 hash,
        bytes calldata signature
    ) external {
        bytes memory old = publicKeys[msg.sender];
        require(old.length != 0, "Not registered");

        address recovered = recoverSigner(
            toEthSignedMessageHash(hash),
            signature
        );
        require(recovered == msg.sender, "Invalid signature");

        publicKeys[msg.sender] = newPubKey;
        emit UserKeyUpdated(msg.sender, old, newPubKey);
    }

    function recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(hash, v, r, s);
    }

    function toEthSignedMessageHash(
        bytes32 hash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    function getKey(address user) external view returns (bytes memory) {
        return publicKeys[user];
    }
}
