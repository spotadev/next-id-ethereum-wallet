import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import axios from 'axios';
import appStyle from '../App.module.css';
import { hashMessage, recoverPublicKey } from 'viem';
import { signMessage } from '@wagmi/core'

export interface PostContent {
  default: string;
  en_US: string;
  zh_CN: string;
}

export interface ProofPayloadResponse {
  post_content: PostContent;
  sign_payload: string;
  uuid: string;
  created_at: string;
}

export interface Platform {
  name: string;
  url: string;
}

export interface Proof {
  platform: string;
  identity: string;
  created_at: string;
  last_checked_at: string;
  is_valid: boolean;
  invalid_reason: string;
}

export interface IdsItem {
  avatar: string;
  persona: string;
  activated_at: string;
  last_arweave_id: String;
  proofs: Proof[];
}

export interface Pagination {
  total: number;
  per: number;
  current: number;
  next: number;
}

export default interface AvatarStatusResponse {
  pagination: Pagination;
  ids: IdsItem[];
}

export function Home() {
  const [addressToAdd, seAddressToAdd] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>();
  const [verifiedProof, setVerifiedProof] = useState<boolean>(false);
  const [avatarStatusResponse, setAvatarStatusResponse] = useState<AvatarStatusResponse | null>(null);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open, close } = useWeb3Modal();

  const getProofPayloadResponse =
    async (address: string, publicKey: string): Promise<ProofPayloadResponse> => {
      const baseUrl = process.env.REACT_APP_PROOF_SERVICE_BASE_URL;

      if (!baseUrl) {
        throw new Error('Could not read env properties');
      }

      const url = baseUrl + '/v1/proof/payload';

      let config = {
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const request =
      {
        "action": "create",
        "platform": "ethereum",
        "identity": address,
        "public_key": publicKey
      };

      let { data, status } =
        await axios.post<ProofPayloadResponse>(url, request, config);

      if (status === 200) {
        return data;
      } else if (status === 404) {
        throw new Error('Not Found: 404');
      } else {
        throw new Error('Fauled to get ProofPayloadResponse: ' + status);
      }
    }

  const getNextIdProofPayload =
    async (
      address: string
    ): Promise<{ proofPayloadResponse: ProofPayloadResponse, publicKey: string }> => {
      const message = 'next.id rocks';
      const signature = await signMessage({ message: message });
      const messageHash = hashMessage(message);
      console.log('message', message);
      console.log('signature', signature);
      console.log('messageHash', messageHash);

      const recoveredPublicKey = await recoverPublicKey({
        hash: messageHash,
        signature: signature
      });

      setPublicKey(recoveredPublicKey);

      const proofPayloadResponse: ProofPayloadResponse =
        await getProofPayloadResponse(address, recoveredPublicKey);

      console.log('recoveredPublicKey', recoveredPublicKey);
      console.log('proofPayloadResponse', proofPayloadResponse);
      return {
        proofPayloadResponse: proofPayloadResponse,
        publicKey: recoveredPublicKey
      };
    }

  const verifyProof = async (
    signedPayloadBase64: string,
    address: string,
    publicKey: string,
    createdAt: string,
    uuid: string
  ): Promise<boolean> => {

    const baseUrl = process.env.REACT_APP_PROOF_SERVICE_BASE_URL;

    if (!baseUrl) {
      throw new Error('Could not read env properties');
    }

    const url = baseUrl + '/v1/proof';

    let config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const request =
    {
      "action": "create",
      "platform": "ethereum",
      "identity": address,
      "public_key": publicKey,
      "extra": { signatures: [signedPayloadBase64, signedPayloadBase64] },
      "uuid": uuid,
      "created_at": createdAt
    };

    let { status } = await axios.post<{}>(url, request, config);

    return status === 201;
  }

  const getAvatarDetails = async () => {
    const baseUrl = process.env.REACT_APP_PROOF_SERVICE_BASE_URL;
    const platform = 'ethereum';
    const exact = true;
    const url = `${baseUrl}/v1/proof?platform=${platform}&identity=${addressToAdd}&exact=${exact}`;

    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    let { data, status } = await axios.get<AvatarStatusResponse>(url, config);
    const avatarStatusResponse: AvatarStatusResponse = data;

    if (status !== 200) {
      throw new Error(`Failed to get AvatarStatusResponse. Status: ${status}`);
    }

    setAvatarStatusResponse(avatarStatusResponse);
  }

  const next = async () => {
    if (address) {

      // Get payload to sign
      const response: { proofPayloadResponse: ProofPayloadResponse, publicKey: string } =
        await getNextIdProofPayload(address);

      const publicKey = response.publicKey;
      const proofPayloadResponse = response.proofPayloadResponse;
      const message = proofPayloadResponse.sign_payload;

      // sign payload and convert signature to base64
      const signedPayload = await signMessage({ message: message });
      console.log('signedPayload', signedPayload);
      const signatureWithoutPrefix = signedPayload.slice(2);
      const bufferSignatureWithoutPrefix = Buffer.from(signatureWithoutPrefix, 'hex');
      const signedPayloadBase64 = bufferSignatureWithoutPrefix.toString('base64');
      console.log('signedPayloadBase64', signedPayloadBase64);

      // call proof
      const createdAt = response.proofPayloadResponse.created_at;
      const uuid = response.proofPayloadResponse.uuid;
      const veriiedProof = await verifyProof(signedPayloadBase64, address, publicKey, createdAt, uuid);
      setVerifiedProof(veriiedProof);

      // get Avatar details
      getAvatarDetails();
    }
  }

  const getConnectWalletJSX = () => {
    if (isConnected) {
      return (
        <>
          <div style={{ fontWeight: 'bold', paddingTop: '20px' }}>Wallet Address:</div>
          <div style={{ paddingTop: '20px' }}>
            ${address}
          </div>
          <div style={{ paddingTop: '20px' }}>
            <button className={appStyle.button} onClick={() => disconnect()}>Disconnect Wallet</button>
          </div >
        </>
      );
    }
    else {
      return (
        <div>
          Connect to Wallet - PENDING
          &nbsp;&nbsp;
          <button className={appStyle.button} onClick={() => open()}>Connect / Disconnect Wallet</button>
          &nbsp;&nbsp;
          <button className={appStyle.button} onClick={() => open({ view: 'Networks' })}>Select Network</button>
        </div>
      )
    }
  }

  const getDIDAddedJSX = () => {
    if (verifiedProof && avatarStatusResponse) {
      return (
        <p>
          Your ethereum address has been added to your next.id DID
        </p>

      );
    } else if (avatarStatusResponse) {
      return (
        <p>
          Your ethereum address was not added successfully
        </p>
      );
    }
    else {
      return '';
    }
  }

  const getAvatarStatusJSX = () => {
    if (verifiedProof && avatarStatusResponse && avatarStatusResponse.ids.length > 0) {
      return (
        <div>
          <div style={{ fontWeight: 'bold', paddingBottom: '10px', paddingTop: '20px' }}>DID details:</div>
          {
            avatarStatusResponse.ids.map((id, index) => (
              <div key={id.avatar} style={{ padding: '10px', backgroundColor: index % 2 === 0 ? 'lightGreen' : 'white' }}>
                <div>
                  <span style={{ display: 'inline-block', width: '150px' }}>Avatar:</span>
                  <span>{id.avatar}</span>
                </div>
                <div>
                  <span style={{ display: 'inline-block', width: '150px' }}>Persona:</span>
                  <span>{id.persona}</span>
                </div>
                <div>
                  <span style={{ display: 'inline-block', width: '150px' }}>Activated at:</span>
                  <span>{id.activated_at}</span>
                </div>
                {
                  id.proofs.map(
                    (proof, index2) => (
                      <div key={proof.identity} style={{ paddingLeft: '10px;' }}>
                        <div>
                          <span style={{ display: 'inline-block', width: '150px' }}>Proof created at:</span>
                          <span>{proof.created_at}</span>
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', width: '150px' }}>Handle:</span>
                          <span>{proof.identity}</span>
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', width: '150px' }}>Platform:</span>
                          <span>{proof.platform}</span>
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', width: '150px' }}>Is Valid:</span>
                          <span>{proof.is_valid}</span>
                        </div>
                        <div>
                          <span style={{ width: '200px' }}>Invalid Reason:</span>
                          <span>{proof.invalid_reason}</span>
                        </div>
                        <div>
                          <span style={{ display: 'inline-block', width: '150px' }}>Last Checked at:</span>
                          <span>{proof.last_checked_at}</span>
                        </div>
                      </div>
                    )
                  )
                }
              </div>
            ))
          }
        </div>
      );
    }
    else if (avatarStatusResponse) {
      return (
        <>
          <div style={{ fontWeight: 'bold', paddingBottom: '10px', paddingTop: '20px' }}>DID details:</div>
          <div style={{ backgroundColor: 'lightgreen', color: 'red', padding: '10px' }}>
            No Avatar / Decentralised (DID) found.
          </div>
        </>
      );
    }
    else {
      return '';
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Next.id DID management for adding an ethereum wallet address to your Next.id DID</h2>
      <h3>Intro</h3>
      <p>
        This code uses Meta Mask so make sure you have installed it.
      </p>
      <p>
        This code also uses the PolygonMumbai (testnet) Network so make sure you have it configured
        in your metamask.
      </p>
      <p>
        The README.md file has instructions on how to do the above. It also has instructions
        on how to configure your .env.local file and how do get an ID needed for connecting
        to your wallet.
      </p>
      <h3>Instructions</h3>
      <p>
        Click on the button below to connect your Meta Mask wallet:
      </p>
      {getConnectWalletJSX()}

      <div style={{ fontWeight: 'bold', paddingTop: '20px' }}>Press Next Instructions:</div>
      <p>
        Once you are connected above, press Next.  The code will do the following:
        <ul>
          <li></li>
        </ul>
      </p>
      <p>
        <button className={appStyle.button} onClick={() => next()}>Next</button>
      </p>

      {getAvatarStatusJSX()}
      {getDIDAddedJSX()}
    </div>
  );
}